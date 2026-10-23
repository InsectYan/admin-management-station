'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class BatchController extends Controller {
  async index() {
    try {
      ok(this.ctx, await this.ctx.service.batch.list(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async create() {
    try {
      ok(this.ctx, await this.ctx.service.batch.create(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async show() {
    try {
      ok(this.ctx, await this.ctx.service.batch.show(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async step() {
    try {
      ok(this.ctx, await this.ctx.service.batch.step(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async run() {
    try {
      ok(this.ctx, await this.ctx.service.batch.run(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async pause() {
    try {
      ok(this.ctx, await this.ctx.service.batch.pause(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async resume() {
    try {
      ok(this.ctx, await this.ctx.service.batch.resume(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async cancel() {
    try {
      ok(this.ctx, await this.ctx.service.batch.cancel(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = BatchController;
