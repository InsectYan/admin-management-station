'use strict';

const Controller = require('egg').Controller;

class FitnessPlanController extends Controller {
  async index() {
    const data = await this.service.fitnessPlan.list();
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const data = await this.service.fitnessPlan.findById(this.ctx.params.id);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '计划不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async create() {
    const data = await this.service.fitnessPlan.create(this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async update() {
    const data = await this.service.fitnessPlan.update(this.ctx.params.id, this.ctx.request.body || {});
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '计划不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async saveResults() {
    const data = await this.service.fitnessPlan.saveResults(
      this.ctx.params.id,
      this.ctx.request.body?.results || [],
    );
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async exportReport() {
    const data = await this.service.fitnessPlan.exportReport(this.ctx.params.id);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '计划不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async appendItems() {
    const itemIds = this.ctx.request.body?.item_ids || [];
    const data = await this.service.fitnessPlan.appendItems(this.ctx.params.id, itemIds);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '计划不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async destroy() {
    const ok = await this.service.fitnessPlan.destroy(this.ctx.params.id);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '计划不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
  }
}

module.exports = FitnessPlanController;
