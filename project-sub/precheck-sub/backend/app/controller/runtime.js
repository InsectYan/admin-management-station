'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

class RuntimeController extends Controller {
  async index() {
    ok(this.ctx, await this.ctx.service.runtime.list());
  }

  async probe() {
    try {
      ok(this.ctx, await this.ctx.service.runtime.probe(this.ctx.params.id));
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async start() {
    try {
      ok(this.ctx, await this.ctx.service.runtime.start(this.ctx.params.id));
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }
}

module.exports = RuntimeController;
