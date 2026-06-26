'use strict';

const Controller = require('egg').Controller;

class ModuleController extends Controller {
  async index() {
    const list = await this.service.module.listAll();
    this.ctx.body = { code: 0, message: 'ok', data: { list } };
  }
}

module.exports = ModuleController;
