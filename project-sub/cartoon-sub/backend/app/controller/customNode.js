'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
const { fail } = require('../lib/httpError');

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
