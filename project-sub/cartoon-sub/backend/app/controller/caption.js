'use strict';

const Controller = require('egg').Controller;
const { fail } = require('../lib/httpError');

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

class CaptionController extends Controller {
  async show() {
    try {
      ok(this.ctx, await this.ctx.service.caption.show(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async save() {
    try {
      ok(this.ctx, await this.ctx.service.caption.save(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async upload() {
    try {
      ok(this.ctx, await this.ctx.service.caption.upload(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async remove() {
    try {
      ok(this.ctx, await this.ctx.service.caption.remove(this.ctx.params.id, this.ctx.params.cardId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async file() {
    try {
      await this.ctx.service.caption.sendFile(this.ctx.params.id, this.ctx.params.cardId);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async run() {
    try {
      ok(this.ctx, await this.ctx.service.caption.run(this.ctx.params.id, this.ctx.params.cardId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async runEmpty() {
    try {
      ok(this.ctx, await this.ctx.service.caption.runEmpty(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async library() {
    try {
      ok(this.ctx, await this.ctx.service.caption.library());
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = CaptionController;
