'use strict';

const Controller = require('egg').Controller;
const menuMaster = require('../lib/menuMaster');

class ProfileController extends Controller {
  success(data) {
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  fail(err) {
    const status = err.status || 500;
    this.ctx.status = status;
    this.ctx.body = { code: status, message: err.message || '请求失败', data: null };
  }

  async github() {
    try {
      const data = await menuMaster.fetchProfileStatus(this.ctx);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async saveGithub() {
    try {
      const user = await menuMaster.saveGithubToken(this.ctx, this.ctx.request.body || {});
      this.success({
        user,
        github_token_configured: true,
        github_login: user.github_login || '',
      });
    } catch (err) {
      this.fail(err);
    }
  }
}

module.exports = ProfileController;
