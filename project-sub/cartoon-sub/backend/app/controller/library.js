'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class LibraryController extends Controller {
  async assets() {
    try {
      ok(this.ctx, await this.ctx.service.library.assets(this.ctx.params.kind || ''));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async batches() {
    try {
      ok(this.ctx, await this.ctx.service.library.batches());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async reviews() {
    try {
      ok(this.ctx, await this.ctx.service.library.reviews());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async review() {
    try {
      ok(this.ctx, await this.ctx.service.library.review(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async versions() {
    try {
      ok(this.ctx, await this.ctx.service.library.versions());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async exports() {
    try {
      ok(this.ctx, await this.ctx.service.library.exports());
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = LibraryController;
