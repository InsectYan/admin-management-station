'use strict';

const Controller = require('egg').Controller;

class LlmController extends Controller {
  /** GET /api/llm/profiles — 代理 agent-management-master catalog */
  async profiles() {
    try {
      const data = await this.service.llm.fetchProfiles();
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      const status = Number(err.status);
      this.ctx.status = (status >= 400 && status < 600) ? status : 502;
      this.ctx.body = {
        code: this.ctx.status,
        message: err.message || '无法获取 LLM 配置',
        data: null,
      };
    }
  }
}

module.exports = LlmController;
