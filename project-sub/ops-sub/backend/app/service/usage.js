'use strict';

const Service = require('egg').Service;

const APPS = [ 'video', 'narrative', 'agent' ];

class UsageService extends Service {
  number(value, name) {
    const count = Number(value || 0);
    if (!Number.isInteger(count) || count < 0) this.ctx.throw(400, `${name}需要是非负整数`);
    return count;
  }

  async record(payload) {
    const biz = String(payload.biz_app || '');
    if (!APPS.includes(biz)) this.ctx.throw(400, '业务不存在');
    const projectId = String(payload.project_id || '').trim();
    if (!projectId) this.ctx.throw(400, '需要项目编号');
    return this.ctx.model.OpsUsageEvent.create({
      actor: String(payload.actor || this.ctx.state.user?.username || '').slice(0, 128),
      biz_app: biz,
      project_id: projectId.slice(0, 64),
      model_profile: String(payload.model_profile || '').slice(0, 80),
      call_count: this.number(payload.call_count, '次数'),
      media_seconds: this.number(payload.media_seconds, '秒数'),
      storage_bytes: this.number(payload.storage_bytes, '存储'),
    });
  }

  async summary(query) {
    const where = {};
    if (query.biz_app) where.biz_app = String(query.biz_app);
    if (query.project_id) where.project_id = String(query.project_id);
    const rows = await this.ctx.model.OpsUsageEvent.findAll({ where, order: [[ 'id', 'DESC' ]] });
    return {
      call_count: rows.reduce((sum, row) => sum + row.call_count, 0),
      media_seconds: rows.reduce((sum, row) => sum + row.media_seconds, 0),
      storage_bytes: rows.reduce((sum, row) => sum + Number(row.storage_bytes), 0),
      events: rows.slice(0, 50),
    };
  }
}

module.exports = UsageService;
