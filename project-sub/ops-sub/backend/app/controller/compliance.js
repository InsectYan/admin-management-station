'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class ComplianceController extends Controller {
  async index() {
    try {
      ok(this.ctx, await this.ctx.service.compliance.list());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async create() {
    try {
      ok(this.ctx, await this.ctx.service.compliance.create(this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async update() {
    try {
      ok(this.ctx, await this.ctx.service.compliance.update(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async rules() {
    try {
      ok(this.ctx, await this.ctx.service.compliance.list());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async check() {
    try {
      ok(this.ctx, await this.ctx.service.compliance.check(this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = ComplianceController;
