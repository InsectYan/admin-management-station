'use strict';

const Service = require('egg').Service;

const KINDS = [ 'style', 'brand', 'platform', 'banned', 'rating', 'cost' ];
const RATINGS = [ '全年龄', '青少年', '成人' ];
const TYPES = [ 'ai_comic', 'ai_short', 'ai_science', 'ai_commerce' ];

class RuleService extends Service {
  normalize(payload, existing) {
    const contentType = payload.content_type || existing?.content_type;
    if (!TYPES.includes(contentType)) this.ctx.throw(400, '这个内容类型还没开放');
    const kind = payload.kind || existing?.kind;
    if (!KINDS.includes(kind)) this.ctx.throw(400, '规则类型不存在');
    const name = String(payload.name ?? existing?.name ?? '').trim();
    const body = String(payload.body ?? existing?.body ?? '').trim();
    if (!name) this.ctx.throw(400, '需要规则名称');
    let costCap = null;
    if (kind === 'cost') {
      costCap = Number(payload.cost_cap ?? existing?.cost_cap);
      if (!Number.isInteger(costCap) || costCap <= 0) this.ctx.throw(400, '成本上限需要是正整数');
    } else if (kind === 'rating') {
      if (!RATINGS.includes(body)) this.ctx.throw(400, '分级不在可选范围内');
    } else if (!body) this.ctx.throw(400, '需要规则内容');
    return {
      content_type: contentType,
      kind,
      name,
      body,
      cost_cap: costCap,
      enabled: payload.enabled === undefined ? (existing ? existing.enabled : true) : Boolean(payload.enabled),
    };
  }

  async list(contentType) {
    if (contentType && !TYPES.includes(contentType)) this.ctx.throw(400, '这个内容类型还没开放');
    const where = contentType ? { content_type: contentType } : {};
    return this.ctx.model.Rule.findAll({ where, order: [[ 'id', 'ASC' ]] });
  }

  async create(payload) {
    return this.ctx.model.Rule.create(this.normalize(payload));
  }

  async update(id, payload) {
    const row = await this.ctx.model.Rule.findByPk(id);
    if (!row) this.ctx.throw(404, '规则不存在');
    await row.update(this.normalize({ ...row.toJSON(), ...payload }, row));
    return row;
  }
}

module.exports = RuleService;
