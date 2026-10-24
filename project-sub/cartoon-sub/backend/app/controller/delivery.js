'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class DeliveryController extends Controller {
  async specs() {
    try {
      ok(this.ctx, await this.ctx.service.delivery.specs(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async createSpec() {
    try {
      ok(this.ctx, await this.ctx.service.delivery.createSpec(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async frameDiff() {
    try {
      ok(this.ctx, await this.ctx.service.delivery.frameDiff(
        this.ctx.params.id,
        this.ctx.query.left,
        this.ctx.query.right,
      ));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async face() {
    try {
      ok(this.ctx, await this.ctx.service.delivery.markFace(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async file() {
    try {
      await this.ctx.service.delivery.sendFile(this.ctx.params.id);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async lineage() {
    try {
      ok(this.ctx, await this.ctx.service.delivery.lineage(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async previewProfiles() {
    try {
      ok(this.ctx, await this.ctx.service.delivery.previewProfiles(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = DeliveryController;
