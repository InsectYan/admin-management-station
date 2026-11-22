'use strict';

const Controller = require('egg').Controller;

class ExecutionController extends Controller {
  async reply(work) {
    try {
      const data = await work();
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      const status = err.status || 502;
      this.ctx.status = status;
      this.ctx.body = { code: status, message: err.message || '请求失败', data: null };
    }
  }

  index() {
    return this.reply(() => this.ctx.service.execution.list(this.ctx.query));
  }

  skills() {
    return this.reply(() => this.ctx.service.execution.skills());
  }

  show() {
    return this.reply(() => this.ctx.service.execution.show(this.ctx.params.id));
  }
}

module.exports = ExecutionController;
