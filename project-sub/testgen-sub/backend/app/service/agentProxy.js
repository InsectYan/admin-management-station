'use strict';

const Service = require('egg').Service;

class AgentProxyService extends Service {
  async invokeTestgen(payload) {
    const { baseUrl, invokePath, timeout } = this.config.agentPlatform;
    const res = await this.ctx.curl(`${baseUrl}${invokePath}`, {
      method: 'POST',
      contentType: 'json',
      data: payload,
      dataType: 'json',
      timeout,
    });

    if (res.status !== 200) {
      const err = new Error(
        res.data?.error || res.data?.message || `Agent 调用失败: ${res.status}`,
      );
      err.status = res.status >= 500 ? 504 : res.status;
      throw err;
    }

    if (res.data?.error) {
      const err = new Error(res.data.error);
      err.status = res.status >= 400 ? res.status : 502;
      throw err;
    }

    const stoppedReason = res.data?.output?.stoppedReason;
    if (stoppedReason === 'llm_error') {
      const err = new Error(res.data?.reply || 'Agent LLM 调用失败');
      err.status = 502;
      throw err;
    }

    return res.data;
  }

  async invokePerfAnalysis(payload) {
    const { baseUrl, perfInvokePath, timeout } = this.config.agentPlatform;
    const path = perfInvokePath || '/api/skills/perf-bottleneck-skill/invoke';
    const res = await this.ctx.curl(`${baseUrl}${path}`, {
      method: 'POST',
      contentType: 'json',
      data: payload,
      dataType: 'json',
      timeout: timeout || 120000,
    });

    if (res.status !== 200) {
      const err = new Error(res.data?.message || res.data?.error || 'Agent 性能分析调用失败');
      err.status = res.status >= 500 ? 504 : res.status;
      throw err;
    }

    return res.data;
  }
}

module.exports = AgentProxyService;
