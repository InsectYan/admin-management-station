'use strict';

const Controller = require('egg').Controller;

class InternalController extends Controller {
  async listNovels() {
    const data = await this.service.novel.list({ page: 1, pageSize: 100 });
    this.ctx.body = { novels: data.list || [] };
  }
}

module.exports = InternalController;
