'use strict';

const Controller = require('egg').Controller;

class ApiTemplateGenerationJobController extends Controller {
  async create() {
    const data = await this.service.apiTemplateGenerationJob.createAndRun(this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const job = await this.service.apiTemplateGenerationJob.findById(this.ctx.params.id);
    if (!job) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'api template generation job not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: job };
  }

  async cancel() {
    try {
      const data = await this.service.apiTemplateGenerationJob.cancel(this.ctx.params.id);
      if (!data) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: 'job not found', data: null };
        return;
      }
      this.ctx.body = { code: 0, message: 'cancelled', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async retry() {
    try {
      const data = await this.service.apiTemplateGenerationJob.retry(
        this.ctx.params.id,
        this.ctx.request.body || {},
      );
      if (!data) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: 'job not found', data: null };
        return;
      }
      this.ctx.body = { code: 0, message: 'retrying', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async confirmImport() {
    try {
      const data = await this.service.apiTemplateGenerationJob.confirmImport(
        this.ctx.params.id,
        this.ctx.request.body || {},
      );
      if (!data) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: 'job not found', data: null };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  _checkInternalToken() {
    const expected = this.config.internalApiToken;
    if (!expected) return true;
    const token = this.ctx.get('X-Internal-Token');
    if (token !== expected) {
      this.ctx.status = 401;
      this.ctx.body = { code: 401, message: 'unauthorized', data: null };
      return false;
    }
    return true;
  }

  async updateAgentContext() {
    if (!this._checkInternalToken()) return;

    const job = await this.service.apiTemplateGenerationJob.findById(this.ctx.params.id);
    if (!job) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'job not found', data: null };
      return;
    }

    const patch = this.ctx.request.body || {};
    const data = await this.service.apiTemplateGenerationJob.updateAgentContext(this.ctx.params.id, patch);
    this.ctx.body = { code: 0, message: 'ok', data };
  }
}

module.exports = ApiTemplateGenerationJobController;
