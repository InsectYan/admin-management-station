'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class CustomNodeController extends Controller {
  async run() {
    try {
      ok(this.ctx, await this.ctx.service.customNode.run(
        this.ctx.params.id,
        this.ctx.params.nodeKey,
        this.ctx.request.body || {},
      ));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = CustomNodeController;
