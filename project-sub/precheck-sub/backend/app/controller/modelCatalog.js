'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

class ModelCatalogController extends Controller {
  async list() {
    try {
      ok(this.ctx, await this.ctx.service.modelCatalog.list(this.ctx.params.folder));
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }
}

module.exports = ModelCatalogController;
