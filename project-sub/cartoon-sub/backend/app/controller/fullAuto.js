'use strict';

const Controller = require('egg').Controller;
const { fail } = require('../lib/httpError');

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

class FullAutoController extends Controller {
  async index() {
    try {
      ok(this.ctx, await this.ctx.service.fullAuto.list(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async active() {
    try {
      ok(this.ctx, await this.ctx.service.fullAuto.active(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async show() {
    try {
      ok(this.ctx, await this.ctx.service.fullAuto.show(this.ctx.params.id, this.ctx.params.runId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async generateAssets() {
    try {
      ok(this.ctx, await this.ctx.service.fullAuto.startAssets(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async start() {
    try {
      ok(this.ctx, await this.ctx.service.fullAuto.start(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async stop() {
    try {
      ok(this.ctx, await this.ctx.service.fullAuto.stop(this.ctx.params.id, this.ctx.params.runId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = FullAutoController;
