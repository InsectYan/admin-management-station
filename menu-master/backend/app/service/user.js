'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Service } = require('egg');

const ROLES = new Set([ 'admin', 'operator' ]);
const STATUSES = new Set([ 'pending', 'active', 'disabled' ]);
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function publicUser(row) {
  if (!row) return null;
  const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  return {
    id: json.id,
    username: json.username,
    email: json.email,
    role: json.role,
    status: json.status,
    mfa_enabled: !!json.mfa_enabled,
    created_at: json.created_at,
    updated_at: json.updated_at,
  };
}

function randomPassword() {
  return `Tmp${crypto.randomBytes(5).toString('hex')}a1`;
}

class UserService extends Service {
  actorFromState() {
    const payload = this.ctx.state.user || {};
    return {
      id: payload.sub || payload.id,
      username: payload.username,
      role: payload.role,
    };
  }

  async findRow(id) {
    const row = await this.ctx.model.PlatformUser.findByPk(id);
    if (!row) this.ctx.throw(404, '用户不存在');
    return row;
  }

  async countActiveAdmins() {
    return this.ctx.model.PlatformUser.count({
      where: { role: 'admin', status: 'active' },
    });
  }

  async assertSafeAdminChange(row, nextRole, nextStatus, actor) {
    if (Number(row.id) === Number(actor.id) && (nextRole || nextStatus)) {
      this.ctx.throw(400, '不能调整自己的角色或状态');
    }
    const stayingAdmin = row.role === 'admin' && row.status === 'active';
    if (!stayingAdmin) return;
    const demoting = nextRole && nextRole !== 'admin';
    const disabling = nextStatus && nextStatus !== 'active';
    if (!demoting && !disabling) return;
    const n = await this.countActiveAdmins();
    if (n <= 1) this.ctx.throw(400, '不能取消最后一名管理员');
  }

  async list({ page = 1, pageSize = 20, status, role, q } = {}) {
    const where = {};
    if (status && STATUSES.has(status)) where.status = status;
    if (role && ROLES.has(role)) where.role = role;
    if (q) {
      where[this.app.Sequelize.Op.or] = [
        { username: { [this.app.Sequelize.Op.iLike]: `%${q}%` } },
        { email: { [this.app.Sequelize.Op.iLike]: `%${q}%` } },
      ];
    }
    const limit = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit;
    const { rows, count } = await this.ctx.model.PlatformUser.findAndCountAll({
      where,
      order: [[ 'created_at', 'DESC' ]],
      limit,
      offset,
    });
    return {
      list: rows.map(publicUser),
      total: count,
      page: Math.max(1, Number(page) || 1),
      pageSize: limit,
    };
  }

  async updateUser(id, body = {}) {
    const actor = this.actorFromState();
    const row = await this.findRow(id);
    const next = {};
    if (body.role != null) {
      if (!ROLES.has(body.role)) this.ctx.throw(400, '角色仅支持 admin / operator');
      next.role = body.role;
    }
    if (body.status != null) {
      if (!STATUSES.has(body.status)) this.ctx.throw(400, '状态不合法');
      next.status = body.status;
    }
    if (!Object.keys(next).length) this.ctx.throw(400, '没有可更新的字段');

    await this.assertSafeAdminChange(row, next.role, next.status, actor);
    const before = { role: row.role, status: row.status };
    await row.update(next);
    const action = next.status && next.status !== before.status
      ? (next.status === 'active' ? 'approve' : next.status)
      : 'set_role';
    await this.ctx.service.audit.write({
      actor,
      action,
      target: row,
      detail: { before, after: next },
    });
    return publicUser(row);
  }

  async resetPassword(id, body = {}) {
    const actor = this.actorFromState();
    const row = await this.findRow(id);
    let password = String(body.password || '');
    let generated = false;
    if (!password) {
      password = randomPassword();
      generated = true;
    }
    if (!PASSWORD_RE.test(password)) {
      this.ctx.throw(400, '密码至少 8 位，且包含字母和数字');
    }
    await row.update({ password_hash: bcrypt.hashSync(password, 10) });
    await this.ctx.service.audit.write({
      actor,
      action: 'reset_password',
      target: row,
      detail: { generated },
    });
    return { user: publicUser(row), password: generated ? password : undefined };
  }

  async disableMfa(id) {
    const actor = this.actorFromState();
    const row = await this.findRow(id);
    if (!row.mfa_enabled && !row.mfa_secret) {
      this.ctx.throw(400, '该用户未开启二次验证');
    }
    await row.update({ mfa_enabled: false, mfa_secret: null });
    await this.ctx.service.audit.write({
      actor,
      action: 'mfa_disable',
      target: row,
      detail: { by: 'admin' },
    });
    return publicUser(row);
  }
}

module.exports = UserService;
