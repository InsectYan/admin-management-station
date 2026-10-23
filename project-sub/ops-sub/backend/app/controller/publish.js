'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

function fail(ctx, err) {
  const status = err.status || 500;
  ctx.status = status;
  ctx.body = { code: status, message: err.message || '请求失败', data: null };
}

class PublishController extends Controller {
  async channels() {
    try { ok(this.ctx, await this.ctx.service.publish.channels()); }
    catch (err) { fail(this.ctx, err); }
  }

  async createChannel() {
    try { ok(this.ctx, await this.ctx.service.publish.createChannel(this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }

  async records() {
    try { ok(this.ctx, await this.ctx.service.publish.records()); }
    catch (err) { fail(this.ctx, err); }
  }

  async schedule() {
    try { ok(this.ctx, await this.ctx.service.publish.schedule(this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }

  async result() {
    try { ok(this.ctx, await this.ctx.service.publish.result(this.ctx.params.id, this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }

  async takedown() {
    try { ok(this.ctx, await this.ctx.service.publish.takedown(this.ctx.params.id, this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }
}

module.exports = PublishController;
