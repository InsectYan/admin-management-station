'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class UsageController extends Controller {
  async create() {
    try {
      ok(this.ctx, await this.ctx.service.usage.record(this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async summary() {
    try {
      ok(this.ctx, await this.ctx.service.usage.summary(this.ctx.query));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = UsageController;
