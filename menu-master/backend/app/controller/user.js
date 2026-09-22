'use strict';

const Controller = require('egg').Controller;

class UserController extends Controller {
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
      const data = await this.ctx.service.user.list(this.ctx.query);
      this.ok(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async show() {
    try {
      const user = await this.ctx.service.user.getDetail(this.ctx.params.id);
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async update() {
    try {
      const user = await this.ctx.service.user.updateUser(this.ctx.params.id, this.ctx.request.body || {});
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async resetPassword() {
    try {
      const data = await this.ctx.service.user.resetPassword(this.ctx.params.id, this.ctx.request.body || {});
      this.ok(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async disableMfa() {
    try {
      const user = await this.ctx.service.user.disableMfa(this.ctx.params.id);
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }
}

module.exports = UserController;
