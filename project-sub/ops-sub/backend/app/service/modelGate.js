'use strict';

const Service = require('egg').Service;

class ModelGateService extends Service {
  bases() {
    const configured = String(this.config.agentPlatform?.baseUrl || 'http://127.0.0.1:4001').replace(/\/$/, '');
    const bases = [ configured ];
    if (/127\.0\.0\.1|localhost/.test(configured)) bases.push(configured.replace(/127\.0\.0\.1|localhost/, 'host.docker.internal'));
    return bases;
  }

  async agentJson(path) {
    for (const base of this.bases()) {
      try {
        const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(2500) });
        if (!res.ok) continue;
        return await res.json();
      } catch (err) {
        this.ctx.logger.warn('[models] %s', err.message);
      }
    }
    return null;
  }

  async gates() {
    const rows = await this.ctx.model.OpsModelGate.findAll();
    return new Map(rows.map(row => [ `${row.catalog}:${row.profile_id}`, row.enabled ]));
  }

  present(catalog, profile, gates) {
    const enabled = gates.has(`${catalog}:${profile.id}`) ? gates.get(`${catalog}:${profile.id}`) : true;
    return {
      catalog,
      id: profile.id,
      label: profile.label,
      provider: profile.provider,
      enabled,
    };
  }

  async list() {
    const gates = await this.gates();
    const llm = await this.agentJson('/api/llm/profiles');
    const media = await this.agentJson('/api/media/profiles');
    return {
      reachable: Boolean(llm || media),
      profiles: [
        ...(llm?.profiles || []).map(item => this.present('llm', item, gates)),
        ...(media?.profiles || []).map(item => this.present('media', item, gates)),
      ],
    };
  }

  async setEnabled(catalog, profileId, enabled) {
    if (![ 'llm', 'media' ].includes(catalog)) this.ctx.throw(400, '目录不存在');
    const id = String(profileId || '').trim();
    if (!id) this.ctx.throw(400, '需要档位编号');
    const row = await this.ctx.model.OpsModelGate.findOne({ where: { catalog, profile_id: id } });
    if (row) await row.update({ enabled: Boolean(enabled) });
    else await this.ctx.model.OpsModelGate.create({ catalog, profile_id: id, enabled: Boolean(enabled) });
    return { catalog, id, enabled: Boolean(enabled) };
  }

  async enabled(profileId) {
    const id = String(profileId || '').trim();
    if (!id) this.ctx.throw(400, '需要档位编号');
    const row = await this.ctx.model.OpsModelGate.findOne({ where: { profile_id: id, enabled: false } });
    return { profile_id: id, enabled: !row };
  }
}

module.exports = ModelGateService;
