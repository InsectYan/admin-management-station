'use strict';

const Controller = require('egg').Controller;

class AuditController extends Controller {
  async index() {
    try {
      const data = await this.ctx.service.audit.list(this.ctx.query);
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      const status = err.status || 500;
      this.ctx.status = status;
      this.ctx.body = { code: status, message: err.message || '请求失败', data: null };
    }
  }
}

module.exports = AuditController;
