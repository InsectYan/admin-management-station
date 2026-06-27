'use strict';

const Controller = require('egg').Controller;

class EnvConfigController extends Controller {
  async index() {
    const data = await this.service.envConfig.list();
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const row = await this.service.envConfig.findById(this.ctx.params.id);
    if (!row) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'env config not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: row };
  }

  async create() {
    const body = this.ctx.request.body || {};
    if (!body.name || !body.base_url) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: 'name 与 base_url 必填', data: null };
      return;
    }
    const data = await this.service.envConfig.create(body);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async update() {
    const data = await this.service.envConfig.update(this.ctx.params.id, this.ctx.request.body || {});
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'env config not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async destroy() {
    const ok = await this.service.envConfig.delete(this.ctx.params.id);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'env config not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
  }
}

module.exports = EnvConfigController;
