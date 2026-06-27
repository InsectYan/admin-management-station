'use strict';

const Controller = require('egg').Controller;

class TestRunController extends Controller {
  async create() {
    const body = this.ctx.request.body || {};
    const data = await this.service.testRun.createRuns(body);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async index() {
    const { page, page_size, pageSize } = this.ctx.query;
    const data = await this.service.testRun.list({
      page: Number(page) || 1,
      pageSize: page_size || pageSize,
    });
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const data = await this.service.testRun.findById(this.ctx.params.id);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'test run not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async cancel() {
    try {
      const data = await this.service.testRun.cancel(this.ctx.params.id);
      if (!data) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: 'test run not found', data: null };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: err.status || 400, message: err.message, data: null };
    }
  }

  async results() {
    const data = await this.service.testRun.getResults(this.ctx.params.id);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'test run not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }
}

module.exports = TestRunController;
