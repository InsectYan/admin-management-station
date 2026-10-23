'use strict';

const Controller = require('egg').Controller;

class RoleController extends Controller {
  ok(data) {
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  fail(err) {
    const status = err.status || 500;
    this.ctx.status = status;
    this.ctx.body = { code: status, message: err.message || '请求失败', data: null };
  }

  async index() {
    try {
      const list = await this.ctx.service.role.list({ appCode: this.ctx.query.app_code });
      this.ok({ list });
    } catch (err) {
      this.fail(err);
    }
  }

  async open() {
    try {
      const appCode = String(this.ctx.query.app_code || '').trim();
      if (!appCode) this.ctx.throw(400, '需要 app_code');
      const list = await this.ctx.service.role.list({ appCode, enabledOnly: true });
      this.ok({ list });
    } catch (err) {
      this.fail(err);
    }
  }

  async create() {
    try {
      const role = await this.ctx.service.role.create(this.ctx.request.body || {});
      this.ok({ role });
    } catch (err) {
      this.fail(err);
    }
  }

  async update() {
    try {
      const role = await this.ctx.service.role.update(this.ctx.params.id, this.ctx.request.body || {});
      this.ok({ role });
    } catch (err) {
      this.fail(err);
    }
  }

  async replaceForUser() {
    try {
      const body = this.ctx.request.body || {};
      const roles = await this.ctx.service.role.replaceForUser(this.ctx.params.id, body.role_ids);
      this.ok({ roles });
    } catch (err) {
      this.fail(err);
    }
  }
}

module.exports = RoleController;
