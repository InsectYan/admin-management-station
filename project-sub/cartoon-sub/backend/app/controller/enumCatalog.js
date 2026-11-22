'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
const { fail } = require('../lib/httpError');

class EnumCatalogController extends Controller {
  async index() {
    try {
      ok(this.ctx, await this.ctx.service.enumCatalog.list());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async show() {
    try {
      ok(this.ctx, await this.ctx.service.enumCatalog.show(this.ctx.params.key));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async create() {
    try {
      ok(this.ctx, await this.ctx.service.enumCatalog.create(this.ctx.params.key, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async update() {
    try {
      ok(this.ctx, await this.ctx.service.enumCatalog.update(this.ctx.params.key, this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = EnumCatalogController;
