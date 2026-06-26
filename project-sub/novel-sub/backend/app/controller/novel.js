'use strict';

const Controller = require('egg').Controller;

class NovelController extends Controller {
  async index() {
    const { title, status, page = 1, pageSize = 20 } = this.ctx.query;
    const data = await this.service.novel.list({
      title,
      status,
      page: Number(page),
      pageSize: Number(pageSize),
    });
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const novel = await this.service.novel.findById(this.ctx.params.id);
    if (!novel) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'novel not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: novel };
  }

  async create() {
    const novel = await this.service.novel.create(this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'created', data: novel };
  }

  async update() {
    const novel = await this.service.novel.update(this.ctx.params.id, this.ctx.request.body || {});
    if (!novel) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'novel not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: novel };
  }

  async destroy() {
    const ok = await this.service.novel.destroy(this.ctx.params.id);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'novel not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
  }
}

module.exports = NovelController;
