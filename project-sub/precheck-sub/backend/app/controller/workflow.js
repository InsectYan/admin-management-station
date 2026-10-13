'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

class WorkflowController extends Controller {
  async index() {
    ok(this.ctx, await this.ctx.service.workflow.list());
  }

  async show() {
    try {
      ok(this.ctx, await this.ctx.service.workflow.show(this.ctx.params.id));
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async create() {
    const body = this.ctx.request.body || {};
    if (!body.name || !body.api_json) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: '需要 name 和 api_json', data: null };
      return;
    }
    try {
      ok(this.ctx, await this.ctx.service.workflow.create(body));
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async update() {
    const body = this.ctx.request.body || {};
    if (!body.api_json) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: '需要 api_json', data: null };
      return;
    }
    try {
      ok(this.ctx, await this.ctx.service.workflow.update(this.ctx.params.id, body));
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async dependencies() {
    try {
      ok(this.ctx, await this.ctx.service.workflow.dependencies(
        this.ctx.params.id,
        this.ctx.query.runtime_id,
      ));
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }
}

module.exports = WorkflowController;
