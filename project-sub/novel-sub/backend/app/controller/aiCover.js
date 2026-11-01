'use strict';

const Controller = require('egg').Controller;
const { generateCover, listCoverWorkflows, readCoverJob } = require('../lib/aiCover');

class AiCoverController extends Controller {
  async workflows() {
    try {
      const data = await listCoverWorkflows(this.ctx, {
        refresh: this.ctx.query.refresh === '1',
      });
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      const status = err.status || 500;
      this.ctx.status = status;
      this.ctx.body = {
        code: status,
        message: err.message || '读取封面工作流失败',
        error_code: err.code || undefined,
      };
    }
  }

  async job() {
    this.ctx.body = { code: 0, message: 'ok', data: readCoverJob(this.ctx, this.ctx.params.id) };
  }

  async generate() {
    try {
      const data = await generateCover(this.ctx, this.ctx.request.body || {});
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      const status = err.status || 500;
      this.ctx.status = status;
      this.ctx.body = {
        code: status,
        message: err.message || '封面生成失败',
        error_code: err.code || undefined,
      };
    }
  }
}

module.exports = AiCoverController;
