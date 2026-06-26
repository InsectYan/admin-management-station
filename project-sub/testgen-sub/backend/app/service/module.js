'use strict';

const Service = require('egg').Service;

class ModuleService extends Service {
  async listAll() {
    const rows = await this.ctx.model.Module.findAll({
      order: [[ 'sort', 'ASC' ], [ 'id', 'ASC' ]],
    });
    return rows.map(r => r.toJSON());
  }
}

module.exports = ModuleService;
