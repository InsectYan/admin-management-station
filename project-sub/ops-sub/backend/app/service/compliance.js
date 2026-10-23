'use strict';

const Service = require('egg').Service;

const KINDS = [ 'banned', 'rating', 'ai_mark' ];
const RATINGS = [ '全年龄', '青少年', '成人' ];

class ComplianceService extends Service {
  async state() {
    const [ row ] = await this.ctx.model.OpsComplianceState.findOrCreate({
      where: { id: 1 },
      defaults: { id: 1, version: 1 },
    });
    return row;
  }

  async bump() {
    const row = await this.state();
    await row.update({ version: row.version + 1 });
    return row.version;
  }

  normalize(payload, existing) {
    const kind = payload.kind || existing?.kind;
    if (!KINDS.includes(kind)) this.ctx.throw(400, '规则类型不存在');
    const name = String(payload.name ?? existing?.name ?? '').trim();
    if (!name) this.ctx.throw(400, '需要规则名称');
    const body = String(payload.body ?? existing?.body ?? '').trim();
    if (kind === 'rating' && !RATINGS.includes(body)) this.ctx.throw(400, '分级不在可选范围内');
    if (kind === 'banned' && !body) this.ctx.throw(400, '需要规则内容');
    if (kind === 'ai_mark' && ![ '开', '关' ].includes(body)) this.ctx.throw(400, 'AI 标识只能是开或关');
    return {
      kind,
      name,
      body,
      enabled: payload.enabled === undefined ? (existing ? existing.enabled : true) : Boolean(payload.enabled),
    };
  }

  async list() {
    const rules = await this.ctx.model.OpsComplianceRule.findAll({ order: [[ 'id', 'ASC' ]] });
    const state = await this.state();
    return { version: state.version, rules };
  }

  async create(payload) {
    const row = await this.ctx.model.OpsComplianceRule.create(this.normalize(payload));
    const version = await this.bump();
    return { rule: row, version };
  }

  async update(id, payload) {
    const row = await this.ctx.model.OpsComplianceRule.findByPk(id);
    if (!row) this.ctx.throw(404, '规则不存在');
    await row.update(this.normalize({ ...row.toJSON(), ...payload }, row));
    const version = await this.bump();
    return { rule: row, version };
  }

  async check(payload) {
    const text = String(payload.text || '');
    const rules = await this.ctx.model.OpsComplianceRule.findAll({
      where: { enabled: true },
      order: [[ 'id', 'ASC' ]],
    });
    const state = await this.state();
    const hits = [];
    for (const rule of rules) {
      if (rule.kind !== 'banned') continue;
      const terms = String(rule.body || '').split(/\n+/).map(item => item.trim()).filter(Boolean);
      if (terms.some(term => text.includes(term))) hits.push({ id: rule.id, kind: rule.kind });
    }
    const audience = String(payload.audience || '');
    const stage = String(payload.stage || '');
    if (stage === 'export' && audience === 'child') {
      const ratings = rules.filter(rule => rule.kind === 'rating');
      const passed = ratings.some(rule => rule.body === '全年龄');
      if (!passed) {
        const rating = ratings[0];
        hits.push(rating ? { id: rating.id, kind: 'rating' } : { id: 0, kind: 'rating' });
      }
    }
    return {
      version: state.version,
      hits,
      ai_mark: rules.some(rule => rule.kind === 'ai_mark' && rule.body === '开'),
    };
  }
}

module.exports = ComplianceService;
