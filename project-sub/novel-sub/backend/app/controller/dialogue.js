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

class DialogueController extends Controller {
  async index() {
    try { ok(this.ctx, await this.ctx.service.dialogue.list(this.ctx.params.id, this.ctx.query)); }
    catch (err) { fail(this.ctx, err); }
  }

  async create() {
    try { ok(this.ctx, await this.ctx.service.dialogue.create(this.ctx.params.id, this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }

  async update() {
    try { ok(this.ctx, await this.ctx.service.dialogue.update(this.ctx.params.id, this.ctx.params.dialogueId, this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }

  async destroy() {
    try { ok(this.ctx, await this.ctx.service.dialogue.remove(this.ctx.params.id, this.ctx.params.dialogueId)); }
    catch (err) { fail(this.ctx, err); }
  }

  async addChoice() {
    try { ok(this.ctx, await this.ctx.service.dialogue.addChoice(this.ctx.params.id, this.ctx.params.dialogueId, this.ctx.request.body || {})); }
    catch (err) { fail(this.ctx, err); }
  }

  async removeChoice() {
    try { ok(this.ctx, await this.ctx.service.dialogue.removeChoice(this.ctx.params.id, this.ctx.params.dialogueId, this.ctx.params.choiceId)); }
    catch (err) { fail(this.ctx, err); }
  }
}

module.exports = DialogueController;
