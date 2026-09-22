'use strict';

const Controller = require('egg').Controller;

class AuthController extends Controller {
  ok(data) {
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  fail(err) {
    const status = err.status || 500;
    this.ctx.status = status;
    this.ctx.body = { code: status, message: err.message || '请求失败', data: null };
  }

  async register() {
    try {
      const user = await this.ctx.service.auth.register(this.ctx.request.body || {});
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async login() {
    try {
      const data = await this.ctx.service.auth.login(this.ctx.request.body || {});
      this.ok(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async loginMfa() {
    try {
      const data = await this.ctx.service.auth.loginMfa(this.ctx.request.body || {});
      this.ok(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async changePassword() {
    try {
      const user = await this.ctx.service.auth.changePassword(this.ctx.request.body || {});
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async mfaSetup() {
    try {
      const data = await this.ctx.service.auth.mfaSetup();
      this.ok(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async mfaConfirm() {
    try {
      const user = await this.ctx.service.auth.mfaConfirm(this.ctx.request.body || {});
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async mfaDisable() {
    try {
      const user = await this.ctx.service.auth.mfaDisable(this.ctx.request.body || {});
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async me() {
    try {
      const payload = this.ctx.state.user || {};
      const userId = payload.sub || payload.id;
      const user = await this.ctx.service.auth.me(userId);
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async saveGithubToken() {
    try {
      const user = await this.ctx.service.auth.saveGithubToken(this.ctx.request.body || {});
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async clearGithubToken() {
    try {
      const user = await this.ctx.service.auth.clearGithubToken();
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async githubCredential() {
    try {
      const data = await this.ctx.service.auth.readGithubCredential();
      this.ok(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async saveAliyunCredentials() {
    try {
      const user = await this.ctx.service.auth.saveAliyunCredentials(this.ctx.request.body || {});
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async clearAliyunCredentials() {
    try {
      const user = await this.ctx.service.auth.clearAliyunCredentials();
      this.ok({ user });
    } catch (err) {
      this.fail(err);
    }
  }

  async internalGithubCredential() {
    try {
      const expected = process.env.OPS_INTERNAL_KEY || process.env.JWT_SECRET || '';
      const got = this.ctx.get('x-ops-internal-key') || '';
      if (!expected || got !== expected) {
        const err = new Error('内部凭证无效');
        err.status = 403;
        throw err;
      }
      const username = String(this.ctx.query.username || this.ctx.request.body?.username || '').trim();
      const data = await this.ctx.service.auth.readGithubCredentialByUsername(username);
      if (!data) {
        const err = new Error('未配置 GitHub Token');
        err.status = 404;
        throw err;
      }
      this.ok(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async logout() {
    this.ok({ ok: true });
  }
}

module.exports = AuthController;
