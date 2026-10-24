'use strict';

const { Service } = require('egg');

const APPS = new Set([ 'novel', 'cartoon', 'ops' ]);
const ROLES = new Set([ 'author', 'editor', 'producer', 'reviewer' ]);
const ROLE_LABEL = { author: '作者', editor: '编辑', producer: '制作', reviewer: '审核' };

class ProjectMemberService extends Service {
  present(row, user) {
    return {
      id: row.id,
      user_id: row.user_id,
      username: user?.username || '',
      app_key: row.app_key,
      project_id: row.project_id,
      role: row.role,
      role_label: ROLE_LABEL[row.role] || row.role,
    };
  }

  async list(query) {
    const where = {};
    if (query.app_key) where.app_key = String(query.app_key);
    if (query.project_id) where.project_id = Number(query.project_id);
    const rows = await this.ctx.model.PlatformProjectMember.findAll({
      where,
      order: [[ 'id', 'DESC' ]],
      limit: 200,
    });
    const userIds = [ ...new Set(rows.map(item => item.user_id)) ];
    const users = userIds.length
      ? await this.ctx.model.PlatformUser.findAll({ where: { id: userIds } })
      : [];
    const byId = new Map(users.map(item => [ item.id, item ]));
    return { rows: rows.map(item => this.present(item, byId.get(item.user_id))) };
  }

  async create(payload) {
    const userId = Number(payload.user_id);
    const projectId = Number(payload.project_id);
    const appKey = String(payload.app_key || '').trim();
    const role = String(payload.role || '').trim();
    if (!APPS.has(appKey)) this.ctx.throw(400, '应用不存在');
    if (!ROLES.has(role)) this.ctx.throw(400, '角色不存在');
    if (!Number.isInteger(projectId) || projectId <= 0) this.ctx.throw(400, '需要项目编号');
    const user = await this.ctx.model.PlatformUser.findByPk(userId);
    if (!user) this.ctx.throw(404, '用户不存在');
    if (user.status !== 'active') this.ctx.throw(400, '用户还没开通');
    const existing = await this.ctx.model.PlatformProjectMember.findOne({
      where: { user_id: userId, app_key: appKey, project_id: projectId },
    });
    if (existing) this.ctx.throw(400, '这个人已经在项目里');
    const row = await this.ctx.model.PlatformProjectMember.create({
      user_id: userId,
      app_key: appKey,
      project_id: projectId,
      role,
    });
    return this.present(row, user);
  }

  async remove(id) {
    const row = await this.ctx.model.PlatformProjectMember.findByPk(id);
    if (!row) this.ctx.throw(404, '成员不存在');
    await row.destroy();
    return { id: row.id };
  }
}

module.exports = ProjectMemberService;
