'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class ModelGateController extends Controller {
  async index() {
    try {
      ok(this.ctx, await this.ctx.service.modelGate.list());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async update() {
    try {
      const user = this.ctx.state.user || {};
      const admin = user.role === 'admin' || user.account_type === 'super_admin';
      if (!admin) this.ctx.throw(403, '只有管理员能停用档位');
      const enabled = (this.ctx.request.body || {}).enabled;
      ok(this.ctx, await this.ctx.service.modelGate.setEnabled(this.ctx.params.catalog, this.ctx.params.id, enabled));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async check() {
    try {
      ok(this.ctx, await this.ctx.service.modelGate.enabled((this.ctx.request.body || {}).profile_id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = ModelGateController;
