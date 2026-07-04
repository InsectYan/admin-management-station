'use strict';

const Controller = require('egg').Controller;

class GenerationTaskController extends Controller {
  async index() {
    await this.service.generationTask.syncFromItems();
    const list = await this.service.generationTask.list();
    this.ctx.body = { code: 0, message: 'ok', data: list };
  }

  async sync() {
    const data = await this.service.generationTask.syncFromItems();
    this.ctx.body = { code: 0, message: 'ok', data };
  }
}

module.exports = GenerationTaskController;
