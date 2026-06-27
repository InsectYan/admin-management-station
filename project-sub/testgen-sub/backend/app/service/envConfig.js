'use strict';

const Service = require('egg').Service;

class EnvConfigService extends Service {
  async list() {
    const rows = await this.ctx.model.EnvConfig.findAll({
      order: [[ 'id', 'ASC' ]],
    });
    return rows.map(r => r.toJSON());
  }

  async findById(id) {
    const row = await this.ctx.model.EnvConfig.findByPk(id);
    return row ? row.toJSON() : null;
  }

  async create(payload) {
    const row = await this.ctx.model.EnvConfig.create({
      name: payload.name,
      description: payload.description || null,
      base_url: payload.base_url,
      headers_template: payload.headers_template || {},
      variables: payload.variables || {},
    });
    return row.toJSON();
  }

  async update(id, payload) {
    const row = await this.ctx.model.EnvConfig.findByPk(id);
    if (!row) return null;
    await row.update({
      name: payload.name ?? row.name,
      description: payload.description ?? row.description,
      base_url: payload.base_url ?? row.base_url,
      headers_template: payload.headers_template ?? row.headers_template,
      variables: payload.variables ?? row.variables,
    });
    return row.toJSON();
  }

  async delete(id) {
    const row = await this.ctx.model.EnvConfig.findByPk(id);
    if (!row) return false;
    await row.destroy();
    return true;
  }
}

module.exports = EnvConfigService;
