'use strict';

const Controller = require('egg').Controller;

class GenerationQueueController extends Controller {
  async index() {
    const data = await this.service.generationQueue.list();
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async pause() {
    try {
      const data = await this.service.generationQueue.pause(Number(this.ctx.params.jobId));
      this.ctx.body = { code: 0, message: 'paused', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async resume() {
    try {
      const data = await this.service.generationQueue.resume(Number(this.ctx.params.jobId));
      this.ctx.body = { code: 0, message: 'resumed', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async cancel() {
    try {
      const data = await this.service.generationQueue.cancel(Number(this.ctx.params.jobId));
      this.ctx.body = { code: 0, message: 'cancelled', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }
}

module.exports = GenerationQueueController;
