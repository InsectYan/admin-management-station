'use strict';

const Controller = require('egg').Controller;
const { QA_MODULES } = require('../lib/novelQa');

class AiReviewController extends Controller {
  async create() {
    const body = this.ctx.request.body || {};
    const novelId = Number(body.novel_id || this.ctx.params.id);
    if (!Number.isInteger(novelId) || novelId <= 0) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: 'novel_id 必填' };
      return;
    }
    const action = String(body.action || 'check_consistency');
    if (action === 'validate_chapter' && !String(body.chapter_id || '').trim()) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: 'chapter_id 必填' };
      return;
    }
    if (action === 'validate_module' && !String(body.module || '').trim()) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: 'module 必填' };
      return;
    }
    try {
      const data = await this.ctx.service.aiReview.review({
        novelId,
        action,
        module: body.module,
        chapterId: body.chapter_id,
        useLlm: Boolean(body.use_llm),
        persist: body.persist !== false,
      });
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message || '核检失败' };
    }
  }

  async show() {
    const novelId = Number(this.ctx.params.id);
    if (!Number.isInteger(novelId) || novelId <= 0) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: '无效小说 id' };
      return;
    }
    try {
      const data = await this.ctx.service.aiReview.getReport(novelId);
      if (!data) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '小说不存在' };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data: { ...data, modules_meta: QA_MODULES } };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message || '读取核检失败' };
    }
  }

  async ignore() {
    const novelId = Number(this.ctx.params.id);
    const findingId = String(this.ctx.request.body?.finding_id || '').trim().slice(0, 200);
    if (!Number.isInteger(novelId) || novelId <= 0 || !findingId) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: 'finding_id 必填' };
      return;
    }
    try {
      const data = await this.ctx.service.aiReview.ignoreFinding(novelId, findingId);
      if (!data) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '小说不存在' };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message || '忽略失败' };
    }
  }

  async modules() {
    this.ctx.body = { code: 0, message: 'ok', data: { list: QA_MODULES } };
  }
}

module.exports = AiReviewController;
