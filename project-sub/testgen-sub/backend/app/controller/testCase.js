'use strict';

const Controller = require('egg').Controller;

class TestCaseController extends Controller {
  async index() {
    const { job_id, module, type, priority, status, page, page_size, pageSize } = this.ctx.query;
    const data = await this.service.testCase.list({
      job_id: job_id ? Number(job_id) : undefined,
      module,
      type,
      priority,
      status,
      page: Number(page) || 1,
      page_size,
      pageSize,
    });
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async export() {
    const { format, job_id, module, type } = this.ctx.query;
    const content = await this.service.testCase.export({
      format: format || 'markdown',
      job_id: job_id ? Number(job_id) : undefined,
      module,
      type,
    });
    const isCsv = (format || 'markdown') === 'csv';
    this.ctx.set('Content-Type', isCsv ? 'text/csv; charset=utf-8' : 'text/markdown; charset=utf-8');
    this.ctx.set('Content-Disposition', `attachment; filename="test-cases.${isCsv ? 'csv' : 'md'}"`);
    this.ctx.body = content;
  }

  async show() {
    const tc = await this.service.testCase.findById(this.ctx.params.id);
    if (!tc) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'test case not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: tc };
  }

  async update() {
    const tc = await this.service.testCase.update(this.ctx.params.id, this.ctx.request.body || {});
    if (!tc) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'test case not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: tc };
  }

  async destroy() {
    const ok = await this.service.testCase.delete(this.ctx.params.id);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'test case not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
  }
}

module.exports = TestCaseController;
