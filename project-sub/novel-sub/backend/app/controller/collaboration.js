'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

function fail(ctx, err) {
  const status = err.status || 500;
  ctx.status = status;
  ctx.body = { code: status, message: err.message || '请求失败', data: null };
}

class CollaborationController extends Controller {
  async members() {
    try { ok(this.ctx, await this.ctx.service.collaboration.members(this.ctx.params.id)); }
    catch (err) { fail(this.ctx, err); }
  }

  async addMember() {
    try { ok(this.ctx, await this.ctx.service.collaboration.addMember(this.ctx.params.id, this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }

  async removeMember() {
    try { ok(this.ctx, await this.ctx.service.collaboration.removeMember(this.ctx.params.id, this.ctx.params.memberId)); }
    catch (err) { fail(this.ctx, err); }
  }

  async locks() {
    try { ok(this.ctx, await this.ctx.service.collaboration.locks(this.ctx.params.id)); }
    catch (err) { fail(this.ctx, err); }
  }

  async lockChapter() {
    try { ok(this.ctx, await this.ctx.service.collaboration.lockChapter(this.ctx.params.id, this.ctx.params.chapterId, this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }

  async unlockChapter() {
    try { ok(this.ctx, await this.ctx.service.collaboration.unlockChapter(this.ctx.params.id, this.ctx.params.chapterId, this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }

  async activity() {
    try { ok(this.ctx, await this.ctx.service.collaboration.activity(this.ctx.params.id)); }
    catch (err) { fail(this.ctx, err); }
  }
}

module.exports = CollaborationController;
