'use strict';

const Controller = require('egg').Controller;

class HealthController extends Controller {
  async index() {
    this.ctx.body = {
      code: 0,
      message: 'ok',
      data: {
        app_key: 'novel',
        service: 'novel-sub-backend',
      },
    };
  }
}

module.exports = HealthController;
