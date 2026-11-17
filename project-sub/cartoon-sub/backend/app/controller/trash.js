'use strict';

const Controller = require('egg').Controller;
const { fail } = require('../lib/httpError');

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

class TrashController extends Controller {
  async index() {
    try {
      ok(this.ctx, await this.ctx.service.trash.list());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async destroy() {
    try {
      ok(this.ctx, await this.ctx.service.trash.remove(decodeURIComponent(this.ctx.params.id)));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = TrashController;
