'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class OpsInternalController extends Controller {
  async projects() {
    ok(this.ctx, await this.ctx.service.opsInternal.projects());
  }

  async summary() {
    ok(this.ctx, await this.ctx.service.opsInternal.summary(this.ctx.query));
  }

  async tasks() {
    ok(this.ctx, await this.ctx.service.opsInternal.tasks(this.ctx.query));
  }

  async show() {
    try {
      ok(this.ctx, await this.ctx.service.opsInternal.show(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async retry() {
    try {
      ok(this.ctx, await this.ctx.service.opsInternal.retry(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async lineage() {
    try {
      ok(this.ctx, await this.ctx.service.delivery.lineage(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async cancel() {
    try {
      ok(this.ctx, await this.ctx.service.opsInternal.cancel(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = OpsInternalController;
