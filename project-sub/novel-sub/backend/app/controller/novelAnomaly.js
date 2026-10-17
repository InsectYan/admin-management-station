'use strict';

const Controller = require('egg').Controller;

class NovelAnomalyController extends Controller {
  async index() {
    const data = await this.ctx.service.novelAnomaly.list(this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const row = await this.ctx.service.novelAnomaly.findById(this.ctx.params.id);
    if (!row) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '检测记录不存在' };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: row };
  }

  async create() {
    const novelId = Number(this.ctx.request.body?.novel_id);
    const mode = this.ctx.request.body?.mode === 'full' ? 'full' : 'rough';
    if (!novelId) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: '缺少小说' };
      return;
    }
    const row = await this.ctx.service.novelAnomaly.createReport(novelId, mode);
    if (!row) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '小说不存在' };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: row };
  }

  async runTask() {
    try {
      const data = await this.ctx.service.novelAnomaly.runTask(
        this.ctx.params.id,
        this.ctx.params.taskId,
      );
      if (!data) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '检测记录不存在' };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: err.status || 500, message: err.message || '修正失败' };
    }
  }

  async setTaskStatus() {
    try {
      const body = this.ctx.request.body || {};
      const row = await this.ctx.service.novelAnomaly.setTaskStatus(
        this.ctx.params.id,
        this.ctx.params.taskId,
        body.status,
        body.error,
      );
      if (!row) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '检测记录不存在' };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data: row };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: err.status || 500, message: err.message || '更新失败' };
    }
  }
}

module.exports = NovelAnomalyController;
