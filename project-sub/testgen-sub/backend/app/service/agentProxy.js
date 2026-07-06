'use strict';

const Service = require('egg').Service;
const { extractAgentTools } = require('../lib/agentToolsExtract');

class AgentProxyService extends Service {
  /** urllib/egg-curl 未显式 timeout 时默认仅 5s；本地 Ollama 须传足够大的值 */
  _localOllamaHttpTimeoutMs() {
    const cfg = this._skillConfig();
    const fromEnv = Number(process.env.AGENT_LOCAL_OLLAMA_TIMEOUT_MS || 0);
    if (fromEnv > 0) return fromEnv;
    return cfg.generateTimeoutMs || cfg.timeout || 900000;
  }

  _skillConfig() {
    return this.config.agentPlatform || {};
  }

  /** 本地 Ollama 模型：BFF 侧不设 HTTP 超时，等待 Agent 自然结束或报错 */
  _isLocalOllamaProfile(profileId) {
    const id = String(profileId || 'ollama-qwen').trim().toLowerCase();
    return !profileId || id.startsWith('ollama') || id === 'env-fallback';
  }

  /**
   * @param {string} invokePath
   * @param {object} payload
   * @param {number} [timeoutMs] 0 表示不设超时（本地 Ollama）
   */
  async invokeSkill(invokePath, payload, timeoutMs) {
    const { baseUrl, timeout } = this._skillConfig();
    const path = invokePath.startsWith('/') ? invokePath : `/${invokePath}`;
    const trace = payload.trace || {};
    const data = {
      ...payload,
      trace_id: payload.trace_id || trace.trace_id || undefined,
    };
    const started = Date.now();

    const curlOpts = {
      method: 'POST',
      contentType: 'json',
      data,
      dataType: 'json',
    };
    const effectiveTimeout = timeoutMs === 0
      ? this._localOllamaHttpTimeoutMs()
      : (timeoutMs || timeout || 120000);
    curlOpts.timeout = effectiveTimeout;

    const res = await this.ctx.curl(`${baseUrl}${path}`, curlOpts);

    const skill = payload._skill || path.split('/').slice(-2, -1)[0] || 'unknown';
    const action = payload.action || 'invoke';
    const durationMs = Date.now() - started;
    const responseTraceId = res.data?.trace_id || data.trace_id || null;
    const tools = extractAgentTools(res.data);

    const auditBase = {
      skill,
      action,
      run_id: trace.run_id,
      job_id: trace.job_id,
      item_id: trace.item_id,
      trace_id: responseTraceId,
      duration_ms: durationMs,
      tools,
    };

    if (res.status !== 200) {
      await this.ctx.service.agentAudit.log({
        ...auditBase,
        ok: false,
        error: res.data?.error || res.data?.message || `HTTP ${res.status}`,
      });
      const err = new Error(
        res.data?.error || res.data?.message || `Agent 调用失败: ${res.status}`,
      );
      err.status = res.status >= 500 ? 504 : res.status;
      err.code = 'AGENT_INVOKE_FAILED';
      throw err;
    }

    if (res.data?.error) {
      await this.ctx.service.agentAudit.log({
        ...auditBase,
        ok: false,
        error: res.data.error,
      });
      const err = new Error(res.data.error);
      err.status = res.status >= 400 ? res.status : 502;
      err.code = 'AGENT_INVOKE_FAILED';
      throw err;
    }

    const stoppedReason = res.data?.output?.stoppedReason;
    if (stoppedReason === 'llm_error') {
      await this.ctx.service.agentAudit.log({
        ...auditBase,
        ok: false,
        error: res.data?.reply || 'LLM 调用失败',
      });
      const err = new Error(res.data?.reply || 'Agent LLM 调用失败');
      err.status = 502;
      err.code = 'AGENT_LLM_ERROR';
      throw err;
    }

    await this.ctx.service.agentAudit.log({
      ...auditBase,
      ok: true,
      detail: { stopped_reason: stoppedReason || null },
    });

    return res.data;
  }

  async invokeTestgen(payload, timeoutMs) {
    const { invokePath, estimateTimeoutMs, generateTimeoutMs, timeout } = this._skillConfig();
    const isEstimate = payload?.action === 'estimate_case_count'
      || payload?.trace?.action === 'estimate';
    let ms = timeoutMs
      ?? (isEstimate ? estimateTimeoutMs : generateTimeoutMs)
      ?? timeout
      ?? 120000;
    if (this._isLocalOllamaProfile(payload?.llm_profile)) {
      ms = 0;
    }
    return this.invokeSkill(invokePath, { ...payload, _skill: 'testgen-skill' }, ms);
  }

  async invokeObservationMatch(payload, timeoutMs) {
    const { observationMatchInvokePath, judgeTimeoutMs, generateTimeoutMs, timeout } = this._skillConfig();
    const path = observationMatchInvokePath || '/api/skills/fitness-observation-match-skill/invoke';
    let ms = timeoutMs ?? judgeTimeoutMs ?? generateTimeoutMs ?? timeout ?? 120000;
    if (this._isLocalOllamaProfile(payload?.llm_profile)) {
      ms = 0;
    }
    return this.invokeSkill(path, { ...payload, _skill: 'fitness-observation-match-skill' }, ms);
  }

  async invokeFitnessJudge(payload, timeoutMs) {
    const { judgeInvokePath, judgeTimeoutMs, generateTimeoutMs, timeout } = this._skillConfig();
    const path = judgeInvokePath || '/api/skills/fitness-judge-skill/invoke';
    let ms = timeoutMs ?? judgeTimeoutMs ?? generateTimeoutMs ?? timeout ?? 120000;
    if (this._isLocalOllamaProfile(payload?.llm_profile)) {
      ms = 0;
    }
    return this.invokeSkill(path, { ...payload, _skill: 'fitness-judge-skill' }, ms);
  }

  async invokeFitnessSample(payload) {
    const { sampleInvokePath, sampleTimeoutMs } = this._skillConfig();
    const path = sampleInvokePath || '/api/skills/fitness-sample-skill/invoke';
    return this.invokeSkill(path, { ...payload, _skill: 'fitness-sample-skill' }, sampleTimeoutMs);
  }

  async invokeFitnessConfig(payload) {
    const { configInvokePath, configTimeoutMs } = this._skillConfig();
    const path = configInvokePath || '/api/skills/fitness-config-skill/invoke';
    return this.invokeSkill(path, { ...payload, _skill: 'fitness-config-skill' }, configTimeoutMs);
  }

  async invokeFitnessExplore(payload) {
    const { exploreInvokePath, exploreTimeoutMs } = this._skillConfig();
    const path = exploreInvokePath || '/api/skills/fitness-explore-skill/invoke';
    return this.invokeSkill(path, { ...payload, _skill: 'fitness-explore-skill' }, exploreTimeoutMs);
  }

  async invokePerfAnalysis(payload) {
    const { perfInvokePath, timeout } = this._skillConfig();
    const path = perfInvokePath || '/api/skills/perf-bottleneck-skill/invoke';
    return this.invokeSkill(path, { ...payload, _skill: 'perf-bottleneck-skill' }, timeout || 120000);
  }

  async invokeApiTemplate(payload) {
    const { apiTemplateInvokePath, apiTemplateTimeoutMs, timeout } = this._skillConfig();
    const path = apiTemplateInvokePath || '/api/skills/api-template-skill/invoke';
    return this.invokeSkill(
      path,
      { ...payload, _skill: 'api-template-skill' },
      apiTemplateTimeoutMs || timeout || 300000,
    );
  }
}

module.exports = AgentProxyService;
