'use strict';

const Controller = require('egg').Controller;

class HealthController extends Controller {
  async index() {
    const { ctx } = this;
    ctx.body = {
      code: 200,
      message: 'success',
      data: {
        app: process.env.APP_KEY || 'main',
        status: 'ok',
      },
    };
  }
}

module.exports = HealthController;
