'use strict';

const Controller = require('egg').Controller;

class NovelController extends Controller {
  async index() {
    const data = await this.ctx.service.novel.list(this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const row = await this.ctx.service.novel.findById(this.ctx.params.id);
    if (!row) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '小说不存在' };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: row };
  }

  async create() {
    const payload = this.ctx.request.body || {};
    if (!payload.title?.trim()) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: '标题不能为空' };
      return;
    }
    const row = await this.ctx.service.novel.create(payload);
    this.ctx.body = { code: 0, message: 'ok', data: row };
  }

  async update() {
    const row = await this.ctx.service.novel.update(this.ctx.params.id, this.ctx.request.body || {});
    if (!row) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '小说不存在' };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: row };
  }

  async destroy() {
    const ok = await this.ctx.service.novel.remove(this.ctx.params.id);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '小说不存在' };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: null };
  }

  async batchDestroy() {
    const { ids } = this.ctx.request.body || {};
    const count = await this.ctx.service.novel.batchRemove(ids);
    this.ctx.body = { code: 0, message: 'ok', data: { count } };
  }

  async getSetting() {
    const setting = await this.ctx.service.novel.getSetting(this.ctx.params.id);
    if (setting === null) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '小说不存在' };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: setting };
  }

  async updateSetting() {
    const setting = await this.ctx.service.novel.updateSetting(
      this.ctx.params.id,
      this.ctx.request.body || {},
    );
    if (setting === null) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '小说不存在' };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: setting };
  }

  async listChapterMeta() {
    try {
      const list = await this.ctx.service.novel.listChapterMeta(this.ctx.params.id);
      if (list === null) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '小说不存在' };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data: { list } };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: err.status || 500, message: err.message, error_code: err.code };
    }
  }

  async listEmptyChapters() {
    try {
      const list = await this.ctx.service.novel.listEmptyChapters(this.ctx.params.id);
      if (list === null) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '小说不存在' };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data: { list } };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: err.status || 500, message: err.message, error_code: err.code };
    }
  }

  async reader() {
    try {
      const data = await this.ctx.service.novel.getReader(this.ctx.params.id);
      if (data === null) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '小说不存在' };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: err.status || 500, message: err.message, error_code: err.code };
    }
  }

  async showChapterBody() {
    try {
      const data = await this.ctx.service.novel.getChapterBody(
        this.ctx.params.id,
        this.ctx.params.chapterId,
      );
      if (data === null) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '小说不存在' };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: err.status || 500, message: err.message, error_code: err.code };
    }
  }

  async updateChapterBody() {
    try {
      const data = await this.ctx.service.novel.upsertChapterBody(
        this.ctx.params.id,
        this.ctx.params.chapterId,
        this.ctx.request.body?.body,
      );
      if (data === null) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '小说不存在' };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: err.status || 500, message: err.message, error_code: err.code };
    }
  }
}

module.exports = NovelController;
