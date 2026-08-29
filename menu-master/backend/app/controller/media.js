'use strict';

const Controller = require('egg').Controller;

class MediaController extends Controller {
  /** GET /api/media/profiles — 代理 agent-management-master 多模态 catalog */
  async profiles() {
    try {
      const data = await this.service.media.fetchProfiles();
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      const status = Number(err.status);
      this.ctx.status = (status >= 400 && status < 600) ? status : 502;
      this.ctx.body = {
        code: this.ctx.status,
        message: err.message || '无法获取多模态模型配置',
        data: null,
      };
    }
  }
}

module.exports = MediaController;
