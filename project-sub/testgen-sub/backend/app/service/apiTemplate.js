'use strict';

const { QueryTypes } = require('sequelize');

class ApiTemplateService extends require('egg').Service {
  async list(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const where = [ 'is_active = TRUE' ];
    const replacements = { limit: pageSize, offset };

    if (query.project_code) {
      where.push('project_code = :projectCode');
      replacements.projectCode = query.project_code;
    }
    if (query.q) {
      where.push('(name ILIKE :q OR template_code ILIKE :q OR url_path ILIKE :q)');
      replacements.q = `%${query.q}%`;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [ list ] = await this.app.model.query(
      `SELECT * FROM ft_api_template ${whereSql}
       ORDER BY updated_at DESC LIMIT :limit OFFSET :offset`,
      { replacements },
    );
    const [ countRows ] = await this.app.model.query(
      `SELECT COUNT(*)::int AS total FROM ft_api_template ${whereSql}`,
      { replacements },
    );
    return { list, total: countRows[0]?.total || 0, page, pageSize };
  }

  async show(id) {
    const row = await this.ctx.model.FtApiTemplate.findByPk(id);
    if (!row || !row.is_active) {
      const err = new Error('接口模板不存在');
      err.status = 404;
      throw err;
    }
    const linked = await this.listLinkedItems(id);
    return { ...row.toJSON(), linked_items: linked };
  }

  async listLinkedItems(apiTemplateId) {
    const [ rows ] = await this.app.model.query(
      `SELECT DISTINCT rc.item_id, t.item_name, t.scheme_primary_id, rc.scheme_id, rc.updated_at
       FROM ft_run_config rc
       JOIN test_item_detail t ON t.item_id = rc.item_id
       WHERE rc.api_template_id = :id OR (
         rc.use_api_template = TRUE AND (rc.config_json->>'api_template_id')::int = :id
       ) OR (
         rc.config_json->>'execution_mode' = 'api_ctx'
         AND (rc.config_json->>'api_template_id')::int = :id
       )
       ORDER BY rc.updated_at DESC
       LIMIT 200`,
      { replacements: { id: Number(apiTemplateId) }, type: QueryTypes.SELECT },
    );
    return rows;
  }

  _normalizeBody(body = {}) {
    const templateCode = String(body.template_code || '').trim()
      || `api-${Date.now()}`;
    return {
      template_code: templateCode,
      name: String(body.name || templateCode).trim(),
      description: body.description || null,
      project_code: body.project_code || null,
      http_method: (body.http_method || 'POST').toUpperCase(),
      url_path: body.url_path || '/',
      headers_json: body.headers_json || {},
      query_json: body.query_json || {},
      body_template: body.body_template || {},
      inject_schema: Array.isArray(body.inject_schema) ? body.inject_schema : [],
      input_params_schema: Array.isArray(body.input_params_schema) ? body.input_params_schema : [],
      preflight_steps: Array.isArray(body.preflight_steps) ? body.preflight_steps : [],
      export_schema: Array.isArray(body.export_schema) ? body.export_schema : [],
      expect_status: Number(body.expect_status) || 202,
      poll_json: body.poll_json && typeof body.poll_json === 'object' ? body.poll_json : {},
      forbidden_patterns: Array.isArray(body.forbidden_patterns) ? body.forbidden_patterns : [],
    };
  }

  async create(body = {}) {
    const data = this._normalizeBody(body);
    return this.ctx.model.FtApiTemplate.create(data);
  }

  async update(id, body = {}) {
    const row = await this.ctx.model.FtApiTemplate.findByPk(id);
    if (!row) {
      const err = new Error('接口模板不存在');
      err.status = 404;
      throw err;
    }
    const patch = this._normalizeBody({ ...row.toJSON(), ...body, template_code: row.template_code });
    await row.update({
      name: patch.name,
      description: patch.description,
      project_code: patch.project_code,
      http_method: patch.http_method,
      url_path: patch.url_path,
      headers_json: patch.headers_json,
      query_json: patch.query_json,
      body_template: patch.body_template,
      inject_schema: patch.inject_schema,
      input_params_schema: patch.input_params_schema,
      preflight_steps: patch.preflight_steps,
      export_schema: patch.export_schema,
      expect_status: patch.expect_status,
      poll_json: patch.poll_json,
      forbidden_patterns: patch.forbidden_patterns,
    });
    return row;
  }

  async destroy(id) {
    const row = await this.ctx.model.FtApiTemplate.findByPk(id);
    if (!row) {
      const err = new Error('接口模板不存在');
      err.status = 404;
      throw err;
    }
    await row.update({ is_active: false });
    return { id: row.id };
  }
}

module.exports = ApiTemplateService;
