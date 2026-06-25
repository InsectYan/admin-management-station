'use strict';

const Controller = require('egg').Controller;

class KnowledgeController extends Controller {
  async index() {
    const { module, tag, q, page, page_size, pageSize, limit } = this.ctx.query;
    const data = await this.service.knowledge.search({
      module,
      tag,
      q,
      page: Number(page) || 1,
      page_size,
      pageSize,
      limit: limit ? Number(limit) : undefined,
    });
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const entry = await this.service.knowledge.findById(this.ctx.params.id);
    if (!entry) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'knowledge entry not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: entry };
  }

  async create() {
    const body = this.ctx.request.body || {};
    if (!body.module || !body.content) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: 'module and content are required', data: null };
      return;
    }
    const data = await this.service.knowledge.create(body);
    this.ctx.body = { code: 0, message: 'created', data };
  }

  async update() {
    const data = await this.service.knowledge.update(this.ctx.params.id, this.ctx.request.body || {});
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'knowledge entry not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async destroy() {
    const ok = await this.service.knowledge.delete(this.ctx.params.id);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'knowledge entry not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
  }
}

module.exports = KnowledgeController;
