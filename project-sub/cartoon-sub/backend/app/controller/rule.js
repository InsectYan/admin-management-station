'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
const { fail } = require('../lib/httpError');

class RuleController extends Controller {
  async index() {
    try {
      ok(this.ctx, await this.ctx.service.rule.list(this.ctx.query.content_type || ''));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async create() {
    try {
      ok(this.ctx, await this.ctx.service.rule.create(this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async update() {
    try {
      ok(this.ctx, await this.ctx.service.rule.update(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = RuleController;
