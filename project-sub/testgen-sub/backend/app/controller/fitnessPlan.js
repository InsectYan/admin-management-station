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
    const body = this.ctx.request.body || {};
    const resultStatuses = Array.isArray(body.result_statuses) ? body.result_statuses : undefined;
    const data = await this.service.fitnessPlan.exportReport(this.ctx.params.id, {
      result_statuses: resultStatuses,
    });
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '计划不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async exportDocument() {
    const format = this.ctx.request.body?.format || 'plan';
    const data = await this.service.fitnessPlan.exportPlanDocument(this.ctx.params.id, format);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '计划不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async reportStats() {
    const plan = await this.service.fitnessPlan.findById(this.ctx.params.id);
    if (!plan) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '计划不存在', data: null };
      return;
    }
    const stats = await this.service.fitnessPlan.buildReportStats(plan);
    this.ctx.body = { code: 0, message: 'ok', data: stats };
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

  async launch() {
    try {
      const data = await this.service.fitnessPlan.launchPlan(
        Number(this.ctx.params.id),
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: err.status || 500, message: err.message, data: null };
    }
  }

  async planRuns() {
    const data = await this.service.fitnessPlan.getPlanRunSummary(Number(this.ctx.params.id));
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '计划不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async summarizeReport() {
    try {
      const data = await this.service.fitnessPlan.summarizeReport(Number(this.ctx.params.id));
      if (!data) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '计划不存在', data: null };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: err.status || 500, message: err.message, data: null };
    }
  }
}

module.exports = FitnessPlanController;
