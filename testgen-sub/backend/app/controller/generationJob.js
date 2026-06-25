'use strict';

const Controller = require('egg').Controller;

class GenerationJobController extends Controller {
  async create() {
    const data = await this.service.generationJob.createAndRun(this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const job = await this.service.generationJob.findById(this.ctx.params.id);
    if (!job) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'generation job not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: job };
  }

  async testCases() {
    const job = await this.service.generationJob.findById(this.ctx.params.id);
    if (!job) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'generation job not found', data: null };
      return;
    }
    const { page, page_size, pageSize } = this.ctx.query;
    const data = await this.service.generationJob.listTestCases(this.ctx.params.id, {
      page: Number(page) || 1,
      page_size,
      pageSize,
    });
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async cancel() {
    try {
      const data = await this.service.generationJob.cancel(this.ctx.params.id);
      if (!data) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: 'generation job not found', data: null };
        return;
      }
      this.ctx.body = { code: 0, message: 'cancelled', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }
}

module.exports = GenerationJobController;
