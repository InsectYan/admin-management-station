'use strict';

const Controller = require('egg').Controller;

class NovelEnumController extends Controller {
  async index() {
    const data = await this.ctx.service.novelEnum.tree();
    this.ctx.body = { code: 0, message: 'ok', data };
  }
}

module.exports = NovelEnumController;
