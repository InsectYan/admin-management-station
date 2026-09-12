'use strict';

const { Op } = require('sequelize');
const {
  buildEmptyTemplate,
  parseImportDocument,
  serializeExport,
  normalizeProjectPayload,
  demoProjects,
} = require('../lib/projectTemplate');

const SORT_FIELDS = new Set([ 'name', 'project_type', 'status', 'updated_at', 'created_at' ]);

class ProjectService extends require('egg').Service {
  toRow(payload) {
    return {
      name: payload.name,
      project_type: payload.project_type,
      description: payload.description,
      repo_url: payload.repo_url,
      status: payload.status,
      directory_tree: payload.directory_tree,
      routes: payload.routes,
      flows: payload.flows,
      extra_json: payload.extra_json,
    };
  }

  async list(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 12));
    const where = {};
    if (query.name) {
      where.name = { [Op.iLike]: `%${String(query.name).trim()}%` };
    }
    if (query.project_type) where.project_type = query.project_type;
    if (query.status) where.status = query.status;

    const sortBy = SORT_FIELDS.has(query.sortBy) ? query.sortBy : 'updated_at';
    const sortOrder = String(query.sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const { rows, count } = await this.ctx.model.OpsProject.findAndCountAll({
      where,
      order: [[ sortBy, sortOrder ]],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });

    return {
      list: rows.map(item => item.toJSON()),
      total: count,
      page,
      pageSize,
    };
  }

  async findById(id) {
    const row = await this.ctx.model.OpsProject.findByPk(id);
    if (!row) {
      const err = new Error('项目不存在');
      err.status = 404;
      throw err;
    }
    return row.toJSON();
  }

  async create(body) {
    const payload = normalizeProjectPayload(body);
    const row = await this.ctx.model.OpsProject.create(this.toRow(payload));
    return row.toJSON();
  }

  async update(id, body) {
    const row = await this.ctx.model.OpsProject.findByPk(id);
    if (!row) {
      const err = new Error('项目不存在');
      err.status = 404;
      throw err;
    }
    const payload = normalizeProjectPayload({ ...row.toJSON(), ...body, type: body.type || row.project_type });
    await row.update(this.toRow(payload));
    return row.toJSON();
  }

  async destroy(id) {
    const row = await this.ctx.model.OpsProject.findByPk(id);
    if (!row) {
      const err = new Error('项目不存在');
      err.status = 404;
      throw err;
    }
    await row.destroy();
    return { id: Number(id) };
  }

  async importDocument(raw) {
    const payload = parseImportDocument(raw);
    const row = await this.ctx.model.OpsProject.create(this.toRow(payload));
    return row.toJSON();
  }

  exportDocument(row) {
    return serializeExport(row);
  }

  template() {
    return buildEmptyTemplate();
  }

  async seedIfEmpty() {
    const count = await this.ctx.model.OpsProject.count();
    if (count > 0) return 0;
    const items = demoProjects();
    for (const item of items) {
      const payload = parseImportDocument(item);
      await this.ctx.model.OpsProject.create(this.toRow(payload));
    }
    return items.length;
  }
}

module.exports = ProjectService;
