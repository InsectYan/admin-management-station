'use strict';

const Service = require('egg').Service;

class AgentProxyService extends Service {
  _skillConfig() {
    return this.config.agentPlatform || {};
  }

  /**
   * @param {string} invokePath
   * @param {object} payload
   * @param {number} [timeoutMs]
   */
  async invokeSkill(invokePath, payload, timeoutMs) {
    const { baseUrl, timeout } = this._skillConfig();
    const path = invokePath.startsWith('/') ? invokePath : `/${invokePath}`;
    const trace = payload.trace || {};
    const data = {
      ...payload,
      trace_id: payload.trace_id || trace.trace_id || undefined,
    };

    const res = await this.ctx.curl(`${baseUrl}${path}`, {
      method: 'POST',
      contentType: 'json',
      data,
      dataType: 'json',
      timeout: timeoutMs || timeout || 120000,
    });

    const skill = payload._skill || path.split('/').slice(-2, -1)[0] || 'unknown';
    const action = payload.action || 'invoke';

    if (res.status !== 200) {
      this.ctx.service.agentAudit.log({
        skill,
        action,
        run_id: trace.run_id,
        job_id: trace.job_id,
        item_id: trace.item_id,
        trace_id: data.trace_id,
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
      this.ctx.service.agentAudit.log({
        skill,
        action,
        run_id: trace.run_id,
        job_id: trace.job_id,
        item_id: trace.item_id,
        trace_id: data.trace_id,
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
      this.ctx.service.agentAudit.log({
        skill,
        action,
        run_id: trace.run_id,
        job_id: trace.job_id,
        item_id: trace.item_id,
        trace_id: data.trace_id,
        ok: false,
        error: res.data?.reply || 'LLM 调用失败',
      });
      const err = new Error(res.data?.reply || 'Agent LLM 调用失败');
      err.status = 502;
      err.code = 'AGENT_LLM_ERROR';
      throw err;
    }

    this.ctx.service.agentAudit.log({
      skill,
      action,
      run_id: trace.run_id,
      job_id: trace.job_id,
      item_id: trace.item_id,
      trace_id: data.trace_id,
      ok: true,
    });

    return res.data;
  }

  async invokeTestgen(payload) {
    const { invokePath } = this._skillConfig();
    return this.invokeSkill(invokePath, { ...payload, _skill: 'testgen-skill' });
  }

  async invokeFitnessJudge(payload) {
    const { judgeInvokePath, judgeTimeoutMs } = this._skillConfig();
    const path = judgeInvokePath || '/api/skills/fitness-judge-skill/invoke';
    return this.invokeSkill(path, { ...payload, _skill: 'fitness-judge-skill' }, judgeTimeoutMs);
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
}

module.exports = AgentProxyService;
