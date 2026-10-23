'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class ReviewController extends Controller {
  async index() {
    try {
      ok(this.ctx, await this.ctx.service.review.list(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async decide() {
    try {
      ok(this.ctx, await this.ctx.service.review.decide(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = ReviewController;
