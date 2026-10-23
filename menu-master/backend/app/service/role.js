'use strict';

const { Service } = require('egg');

const CODE_RE = /^[a-z][a-z0-9_]{1,40}$/;

function plain(row) {
  if (!row) return null;
  const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  return {
    id: json.id,
    app_code: json.app_code,
    app_name: json.app_name,
    code: json.code,
    name: json.name,
    remark: json.remark || '',
    status: json.status,
  };
}

class RoleService extends Service {
  async list({ appCode, enabledOnly = false } = {}) {
    const where = {};
    if (appCode) where.app_code = String(appCode).trim();
    if (enabledOnly) where.status = 'enabled';
    const rows = await this.ctx.model.PlatformRole.findAll({
      where,
      order: [[ 'app_code', 'ASC' ], [ 'id', 'ASC' ]],
    });
    return rows.map(plain);
  }

  async create(body) {
    const appCode = String(body.app_code || '').trim();
    const appName = String(body.app_name || '').trim();
    const code = String(body.code || '').trim();
    const name = String(body.name || '').trim();
    if (!CODE_RE.test(appCode)) this.ctx.throw(400, '应用 code 用小写字母开头，只含小写字母、数字和下划线');
    if (!appName) this.ctx.throw(400, '需要子应用名称');
    if (!CODE_RE.test(code)) this.ctx.throw(400, '角色 code 用小写字母开头，只含小写字母、数字和下划线');
    if (!name) this.ctx.throw(400, '需要角色中文名');
    const existed = await this.ctx.model.PlatformRole.findOne({ where: { app_code: appCode, code } });
    if (existed) this.ctx.throw(409, '这个应用下已有同代号角色');
    await this.ctx.model.PlatformRole.update({ app_name: appName }, { where: { app_code: appCode } });
    const row = await this.ctx.model.PlatformRole.create({
      app_code: appCode,
      app_name: appName,
      code,
      name,
      remark: String(body.remark || '').trim(),
      status: 'enabled',
    });
    return plain(row);
  }

  async update(id, body) {
    const row = await this.ctx.model.PlatformRole.findByPk(id);
    if (!row) this.ctx.throw(404, '角色不存在');
    const next = {};
    if (body.name != null) {
      const name = String(body.name || '').trim();
      if (!name) this.ctx.throw(400, '需要角色中文名');
      next.name = name;
    }
    if (body.remark != null) next.remark = String(body.remark || '').trim();
    if (body.status != null) {
      if (![ 'enabled', 'disabled' ].includes(body.status)) this.ctx.throw(400, '状态只接受 enabled 或 disabled');
      next.status = body.status;
    }
    if (body.app_name != null) {
      const appName = String(body.app_name || '').trim();
      if (!appName) this.ctx.throw(400, '需要子应用名称');
      await this.ctx.model.PlatformRole.update({ app_name: appName }, { where: { app_code: row.app_code } });
    }
    if (Object.keys(next).length) await row.update(next);
    return plain(await row.reload());
  }

  async enabledForUsers(userIds) {
    const map = new Map();
    if (!userIds.length) return map;
    const links = await this.ctx.model.PlatformUserRole.findAll({ where: { user_id: userIds } });
    if (!links.length) return map;
    const roles = await this.ctx.model.PlatformRole.findAll({
      where: { id: links.map(item => item.role_id), status: 'enabled' },
    });
    const byId = new Map(roles.map(item => [ Number(item.id), plain(item) ]));
    links.forEach(link => {
      const role = byId.get(Number(link.role_id));
      if (!role) return;
      const userId = Number(link.user_id);
      const list = map.get(userId) || [];
      list.push(role);
      map.set(userId, list);
    });
    return map;
  }

  async replaceForUser(userId, roleIds) {
    const user = await this.ctx.model.PlatformUser.findByPk(userId);
    if (!user) this.ctx.throw(404, '用户不存在');
    const ids = [ ...new Set((roleIds || []).map(item => Number(item)).filter(item => item > 0)) ];
    if (ids.length) {
      const found = await this.ctx.model.PlatformRole.findAll({ where: { id: ids, status: 'enabled' } });
      if (found.length !== ids.length) this.ctx.throw(400, '有角色不存在或已禁用');
    }
    await this.ctx.model.PlatformUserRole.destroy({ where: { user_id: user.id } });
    if (ids.length) {
      await this.ctx.model.PlatformUserRole.bulkCreate(ids.map(roleId => ({
        user_id: user.id,
        role_id: roleId,
      })));
    }
    const map = await this.enabledForUsers([ user.id ]);
    return map.get(Number(user.id)) || [];
  }
}

module.exports = RoleService;
