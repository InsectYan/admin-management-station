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
    const explainMs = 15 * 60 * 1000;
    let ms = timeoutMs
      ?? (payload?.action === 'explain' ? explainMs : null)
      ?? judgeTimeoutMs
      ?? generateTimeoutMs
      ?? timeout
      ?? 120000;
    if (this._isLocalOllamaProfile(payload?.llm_profile)) {
      // 本地 Ollama：仍给足 15 分钟（explain）或沿用大超时，避免默认 5s 掐断
      ms = payload?.action === 'explain'
        ? (timeoutMs || explainMs)
        : (timeoutMs === 0 ? 0 : (timeoutMs || this._localOllamaHttpTimeoutMs()));
    }
    return this.invokeSkill(path, { ...payload, _skill: 'fitness-judge-skill' }, ms);
  }

  /**
   * 流式调用 fitness-judge-skill（SSE），将 Agent 事件回调给 onEvent
   * @param {object} payload
   * @param {number} timeoutMs
   * @param {(event: string, data: object) => void} onEvent
   */
  async invokeFitnessJudgeStream(payload, timeoutMs, onEvent) {
    const { baseUrl, judgeInvokePath } = this._skillConfig();
    const invokePath = judgeInvokePath || '/api/skills/fitness-judge-skill/invoke';
    const streamPath = invokePath.replace(/\/invoke\/?$/, '/invoke-stream');
    const path = streamPath.startsWith('/') ? streamPath : `/${streamPath}`;
    const explainMs = 15 * 60 * 1000;
    const ms = timeoutMs || (payload?.action === 'explain' ? explainMs : 120000);
    const url = `${baseUrl}${path}`;
    const body = { ...payload, _skill: 'fitness-judge-skill', stream: true };
    const started = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err?.name === 'AbortError') {
        const e = new Error(`AI 解读超时（${ms}ms）`);
        e.status = 504;
        e.code = 'EXPLAIN_TIMEOUT';
        throw e;
      }
      const e = new Error(err.message || '连接 Agent 流式接口失败');
      e.status = 502;
      e.code = 'AGENT_STREAM_FAILED';
      throw e;
    }

    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const text = await res.text().catch(() => '');
      const e = new Error(text || `Agent 流式调用失败: HTTP ${res.status}`);
      e.status = res.status >= 500 ? 504 : res.status;
      e.code = 'AGENT_STREAM_FAILED';
      throw e;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let currentEvent = 'message';

    const flushBlock = block => {
      const lines = block.split(/\r?\n/);
      let event = currentEvent;
      const dataLines = [];
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      if (!dataLines.length) return;
      let data;
      try {
        data = JSON.parse(dataLines.join('\n'));
      } catch {
        data = { raw: dataLines.join('\n') };
      }
      try {
        onEvent(event || 'message', data);
      } catch {
        /* ignore consumer errors */
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          flushBlock(block);
        }
      }
      if (buffer.trim()) flushBlock(buffer);
    } finally {
      clearTimeout(timer);
      try { reader.releaseLock(); } catch { /* ignore */ }
    }

    await this.ctx.service.agentAudit.log({
      skill: 'fitness-judge-skill',
      action: payload.action || 'explain',
      run_id: payload.trace?.run_id,
      item_id: payload.trace?.item_id || payload.item_id,
      duration_ms: Date.now() - started,
      ok: true,
      detail: { stream: true },
    });
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

  async invokeFitnessFixedResolve(payload) {
    const { fixedResolveInvokePath, configTimeoutMs } = this._skillConfig();
    const path = fixedResolveInvokePath || '/api/skills/fitness-fixed-resolve-skill/invoke';
    return this.invokeSkill(path, { ...payload, action: payload.action || 'resolve', _skill: 'fitness-fixed-resolve-skill' }, configTimeoutMs);
  }

  async invokeFitnessIntentClassify(payload) {
    const { intentClassifyInvokePath, configTimeoutMs } = this._skillConfig();
    const path = intentClassifyInvokePath || '/api/skills/fitness-intent-classify-skill/invoke';
    return this.invokeSkill(path, { ...payload, action: payload.action || 'classify', _skill: 'fitness-intent-classify-skill' }, configTimeoutMs);
  }

  async invokeFitnessConfigStructure(payload) {
    const { configStructureInvokePath, configTimeoutMs } = this._skillConfig();
    const path = configStructureInvokePath || '/api/skills/fitness-config-structure-skill/invoke';
    return this.invokeSkill(path, { ...payload, action: payload.action || 'propose_patch', _skill: 'fitness-config-structure-skill' }, configTimeoutMs);
  }

  /**
   * 探测执行期补齐所需 N1/N2/N3 Skill 是否已在 Agent 平台加载。
   * @returns {Promise<{ ok: boolean, baseUrl: string, missing: string[], loaded: string[], error?: string }>}
   */
  async probeAutofillSkills() {
    const { baseUrl, timeout } = this._skillConfig();
    const required = [
      'fitness-intent-classify-skill',
      'fitness-fixed-resolve-skill',
      'fitness-config-structure-skill',
    ];
    try {
      const res = await this.ctx.curl(`${baseUrl}/api/plugins`, {
        method: 'GET',
        dataType: 'json',
        timeout: Math.min(timeout || 300000, 8000),
      });
      if (res.status !== 200) {
        return {
          ok: false,
          baseUrl,
          missing: required,
          loaded: [],
          error: `Agent 平台 HTTP ${res.status}`,
        };
      }
      const list = res.data?.data || res.data?.plugins || res.data || [];
      const names = new Set(
        (Array.isArray(list) ? list : [])
          .map(p => p.name || p.id || p)
          .filter(Boolean)
          .map(String),
      );
      const missing = required.filter(n => !names.has(n));
      return {
        ok: missing.length === 0,
        baseUrl,
        missing,
        loaded: required.filter(n => names.has(n)),
      };
    } catch (err) {
      return {
        ok: false,
        baseUrl,
        missing: required,
        loaded: [],
        error: err.message || String(err),
      };
    }
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
