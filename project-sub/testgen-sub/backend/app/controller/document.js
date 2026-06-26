'use strict';

const Controller = require('egg').Controller;

class DocumentController extends Controller {
  async index() {
    const { page, page_size, pageSize, module } = this.ctx.query;
    const data = await this.service.document.list({
      page: Number(page) || 1,
      page_size,
      pageSize,
      module,
    });
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const doc = await this.service.document.findById(this.ctx.params.id);
    if (!doc) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'document not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: doc };
  }

  async create() {
    const data = await this.service.document.create(this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'created', data };
  }

  async upload() {
    const file = this.ctx.request.files?.[0] || this.ctx.request.files?.file;
    const data = await this.service.document.upload(this.ctx.request.body || {}, file);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async destroy() {
    const ok = await this.service.document.delete(this.ctx.params.id);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'document not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
  }
}

module.exports = DocumentController;
