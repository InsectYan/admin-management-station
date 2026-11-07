'use strict';

const fs = require('fs');
const path = require('path');
const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

const { fail } = require('../lib/httpError');

class RefmodController extends Controller {
  async index() {
    try {
      ok(this.ctx, await this.ctx.service.refmod.list(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async create() {
    try {
      ok(this.ctx, await this.ctx.service.refmod.create(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async update() {
    try {
      ok(this.ctx, await this.ctx.service.refmod.update(this.ctx.params.id, this.ctx.params.packId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async destroy() {
    try {
      ok(this.ctx, await this.ctx.service.refmod.remove(this.ctx.params.id, this.ctx.params.packId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async file() {
    try {
      const absolute = await this.ctx.service.refmod.filePath(
        this.ctx.params.id,
        this.ctx.params.packId,
        this.ctx.params.name,
      );
      const ext = path.extname(absolute).toLowerCase();
      this.ctx.type = ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : (ext === '.webp' ? 'webp' : 'png');
      this.ctx.body = fs.createReadStream(absolute);
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = RefmodController;
