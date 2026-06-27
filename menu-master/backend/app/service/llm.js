'use strict';

const Service = require('egg').Service;

class LlmService extends Service {
  async fetchProfiles() {
    const { baseUrl, timeout } = this.config.agentPlatform;
    try {
      const res = await this.ctx.curl(`${baseUrl}/api/llm/profiles`, {
        method: 'GET',
        dataType: 'json',
        timeout,
      });

      if (res.status !== 200) {
        const err = new Error(res.data?.error || `Agent LLM catalog HTTP ${res.status}`);
        err.status = res.status >= 500 ? 502 : res.status;
        throw err;
      }

      return res.data;
    } catch (err) {
      if (err.status > 0) throw err;
      const wrap = new Error(`Agent 平台不可达 (${baseUrl}): ${err.message}`);
      wrap.status = 502;
      throw wrap;
    }
  }
}

module.exports = LlmService;
