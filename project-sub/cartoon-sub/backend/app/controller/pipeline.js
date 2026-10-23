'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class PipelineController extends Controller {
  async show() {
    try {
      ok(this.ctx, await this.ctx.service.pipeline.show(this.ctx.query.content_type || 'ai_comic'));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async addNode() {
    try {
      ok(this.ctx, await this.ctx.service.pipeline.addNode(this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updateNode() {
    try {
      const body = this.ctx.request.body || {};
      ok(this.ctx, await this.ctx.service.pipeline.updateNode(body.content_type, this.ctx.params.nodeKey, body));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeNode() {
    try {
      ok(this.ctx, await this.ctx.service.pipeline.removeNode(this.ctx.query.content_type, this.ctx.params.nodeKey));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async saveAgent() {
    try {
      const body = this.ctx.request.body || {};
      ok(this.ctx, await this.ctx.service.pipeline.saveAgent(body.content_type, this.ctx.params.role, body));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = PipelineController;
