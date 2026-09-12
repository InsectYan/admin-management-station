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
      source_path: payload.source_path,
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

  extractDocument(agentData) {
    const body = agentData || {};
    const output = body.output || body.data?.output || {};
    return {
      document: output.document || output.config || null,
      summary: output.summary || body.reply || '',
      source: output.source || '',
      scan: output.scan || {},
      raw: body,
    };
  }

  async generateConfig(body = {}) {
    const sourcePath = String(body.source_path || '').trim();
    if (!sourcePath) {
      const err = new Error('请填写项目路径（基础信息 source_path）');
      err.status = 400;
      throw err;
    }
    const skill = this.app.config.agentPlatform?.skill || 'ops-project-skill';
    const { invokeSkill } = require('../lib/agentProxy');
    const action = body.action === 'regenerate' ? 'regenerate' : 'generate';
    const result = await invokeSkill(this.ctx, {
      skill,
      action,
      payload: {
        source_path: sourcePath,
        name: body.name || '',
        type: body.type || body.project_type || 'frontend',
        description: body.description || '',
        repo_url: body.repo_url || '',
        status: body.status || 'draft',
        hint: body.hint || '',
        existing: body.existing || null,
        llm_profile: body.llm_profile,
        max_tokens: body.max_tokens,
      },
    });
    const extracted = this.extractDocument(result.data);
    if (!extracted.document) {
      const err = new Error('Agent 未返回有效项目配置');
      err.status = 502;
      throw err;
    }
    const payload = parseImportDocument({
      ...extracted.document,
      name: extracted.document.name || body.name,
      type: extracted.document.type || body.type || body.project_type,
      source_path: extracted.document.source_path || sourcePath,
    });
    return {
      document: {
        schema: 'ops-project/v1',
        version: '1.0.0',
        name: payload.name,
        type: payload.project_type,
        description: payload.description,
        repo_url: payload.repo_url,
        source_path: payload.source_path,
        status: payload.status,
        directory_tree: payload.directory_tree,
        routes: payload.routes,
        flows: payload.flows,
      },
      summary: extracted.summary,
      source: extracted.source,
      scan: extracted.scan,
      elapsed: result.elapsed,
      traceId: result.traceId,
    };
  }

  async generateAndApply(id, body = {}) {
    const row = await this.findById(id);
    const generated = await this.generateConfig({
      ...body,
      name: body.name || row.name,
      type: body.type || row.project_type,
      description: body.description || row.description,
      repo_url: body.repo_url || row.repo_url,
      source_path: body.source_path || row.source_path,
      status: body.status || row.status,
      action: 'regenerate',
      existing: {
        directory_tree: row.directory_tree,
        routes: row.routes,
        flows: row.flows,
      },
    });
    const saved = await this.update(id, {
      ...generated.document,
      name: row.name,
      type: generated.document.type || row.project_type,
      source_path: generated.document.source_path || row.source_path,
    });
    return { ...generated, project: saved };
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
