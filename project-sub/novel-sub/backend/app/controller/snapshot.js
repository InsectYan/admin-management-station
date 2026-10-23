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

class SnapshotController extends Controller {
  async index() {
    try { ok(this.ctx, await this.ctx.service.snapshot.list(this.ctx.params.id)); }
    catch (err) { fail(this.ctx, err); }
  }

  async create() {
    try { ok(this.ctx, await this.ctx.service.snapshot.create(this.ctx.params.id, this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }

  async restore() {
    try { ok(this.ctx, await this.ctx.service.snapshot.restore(this.ctx.params.id, this.ctx.params.snapshotId)); }
    catch (err) { fail(this.ctx, err); }
  }
}

module.exports = SnapshotController;
