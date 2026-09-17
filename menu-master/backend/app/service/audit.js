'use strict';

const { Service } = require('egg');

class AuditService extends Service {
  async write({ actor, action, target, detail }) {
    const payload = {
      actor_id: actor?.id || null,
      actor_username: actor?.username || 'system',
      action,
      target_user_id: target?.id || null,
      target_username: target?.username || null,
      detail: detail == null ? null : (typeof detail === 'string' ? detail : JSON.stringify(detail)),
    };
    await this.ctx.model.PlatformAuditLog.create(payload);
  }

  async list({ page = 1, pageSize = 20, action, q } = {}) {
    const where = {};
    if (action) where.action = String(action);
    if (q) {
      where[this.app.Sequelize.Op.or] = [
        { actor_username: { [this.app.Sequelize.Op.iLike]: `%${q}%` } },
        { target_username: { [this.app.Sequelize.Op.iLike]: `%${q}%` } },
      ];
    }
    const limit = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit;
    const { rows, count } = await this.ctx.model.PlatformAuditLog.findAndCountAll({
      where,
      order: [[ 'created_at', 'DESC' ]],
      limit,
      offset,
    });
    return {
      list: rows.map(row => (typeof row.toJSON === 'function' ? row.toJSON() : row)),
      total: count,
      page: Math.max(1, Number(page) || 1),
      pageSize: limit,
    };
  }
}

module.exports = AuditService;
