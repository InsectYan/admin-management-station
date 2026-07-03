'use strict';

const Controller = require('egg').Controller;

class ApiTemplateController extends Controller {
  async index() {
    const data = await this.service.apiTemplate.list(this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const data = await this.service.apiTemplate.show(this.ctx.params.id);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async create() {
    const data = await this.service.apiTemplate.create(this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async update() {
    const data = await this.service.apiTemplate.update(
      this.ctx.params.id,
      this.ctx.request.body || {},
    );
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async destroy() {
    const data = await this.service.apiTemplate.destroy(this.ctx.params.id);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async linkedItems() {
    const data = await this.service.apiTemplate.listLinkedItems(this.ctx.params.id);
    this.ctx.body = { code: 0, message: 'ok', data };
  }
}

module.exports = ApiTemplateController;
