'use strict';

const Controller = require('egg').Controller;

class ProjectMemberController extends Controller {
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
      this.ok(await this.ctx.service.projectMember.list(this.ctx.query));
    } catch (err) {
      this.fail(err);
    }
  }

  async create() {
    try {
      this.ok(await this.ctx.service.projectMember.create(this.ctx.request.body || {}));
    } catch (err) {
      this.fail(err);
    }
  }

  async destroy() {
    try {
      this.ok(await this.ctx.service.projectMember.remove(this.ctx.params.id));
    } catch (err) {
      this.fail(err);
    }
  }
}

module.exports = ProjectMemberController;
