'use strict';

const fs = require('fs');
const path = require('path');
const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

class RefmodController extends Controller {
  async index() {
    ok(this.ctx, await this.ctx.service.refmod.list());
  }

  async create() {
    try {
      ok(this.ctx, await this.ctx.service.refmod.create(this.ctx.request.body || {}));
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async destroy() {
    try {
      ok(this.ctx, await this.ctx.service.refmod.remove(this.ctx.params.id));
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async file() {
    try {
      const file = this.ctx.service.refmod.filePath(this.ctx.params.id, this.ctx.params.name);
      const ext = path.extname(file).toLowerCase();
      const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
      this.ctx.set('content-type', types[ext] || 'application/octet-stream');
      this.ctx.body = fs.createReadStream(file);
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }
}

module.exports = RefmodController;
