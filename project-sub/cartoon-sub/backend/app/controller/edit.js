'use strict';

const Controller = require('egg').Controller;
const { inspect } = require('../lib/mediaTools');

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class EditController extends Controller {
  async tools() {
    try {
      ok(this.ctx, await inspect(this.app));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async show() {
    try {
      ok(this.ctx, await this.ctx.service.edit.presentProject(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async save() {
    try {
      ok(this.ctx, await this.ctx.service.edit.save(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async seed() {
    try {
      ok(this.ctx, await this.ctx.service.edit.seed(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async startExport() {
    try {
      ok(this.ctx, await this.ctx.service.editExport.start(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async job() {
    try {
      ok(this.ctx, await this.ctx.service.editExport.show(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = EditController;
