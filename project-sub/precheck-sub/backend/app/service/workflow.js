'use strict';

const Service = require('egg').Service;
const { parseApiWorkflow } = require('../lib/workflowParse');
const { buildSupplies } = require('../lib/supplyCatalog');
const { H3_TEMPLATES } = require('../lib/h3Templates');

class WorkflowService extends Service {
  async ensureTemplates() {
    for (const item of H3_TEMPLATES) {
      const parsed = parseApiWorkflow(item.api_json);
      const existing = await this.ctx.model.Workflow.findOne({ where: { name: item.name } });
      const fields = {
        name: item.name,
        category: item.category,
        api_json: item.api_json,
        required_nodes: parsed.required_nodes,
        required_models: parsed.required_models,
        suggested_vram_gb: item.suggested_vram_gb,
      };
      if (!existing) {
        await this.ctx.model.Workflow.create(fields);
        continue;
      }
      const sameNodes = JSON.stringify(existing.required_nodes) === JSON.stringify(parsed.required_nodes);
      const sameModels = JSON.stringify(existing.required_models) === JSON.stringify(parsed.required_models);
      const sameMeta = existing.category === item.category && existing.suggested_vram_gb === item.suggested_vram_gb;
      if (!sameNodes || !sameModels || !sameMeta) await existing.update(fields);
    }
  }

  async list() {
    const rows = await this.ctx.model.Workflow.findAll({
      order: [[ 'id', 'DESC' ]],
      attributes: { exclude: [ 'api_json' ] },
    });
    return rows;
  }

  async show(id) {
    const row = await this.ctx.model.Workflow.findByPk(id);
    if (!row) this.ctx.throw(404, '工作流不存在');
    return row;
  }

  async create(payload) {
    let parsed;
    try {
      parsed = parseApiWorkflow(payload.api_json);
    } catch (err) {
      this.ctx.throw(err.status || 400, err.message);
    }
    return this.ctx.model.Workflow.create({
      name: payload.name,
      category: payload.category || 'text_to_image',
      api_json: payload.api_json,
      required_nodes: parsed.required_nodes,
      required_models: parsed.required_models,
      suggested_vram_gb: payload.suggested_vram_gb || null,
    });
  }

  async update(id, payload) {
    const row = await this.show(id);
    const apiJson = payload.api_json || row.api_json;
    let parsed;
    try {
      parsed = parseApiWorkflow(apiJson);
    } catch (err) {
      this.ctx.throw(err.status || 400, err.message);
    }
    await row.update({
      name: payload.name || row.name,
      category: payload.category || row.category,
      api_json: apiJson,
      required_nodes: parsed.required_nodes,
      required_models: parsed.required_models,
      suggested_vram_gb: payload.suggested_vram_gb === undefined ? row.suggested_vram_gb : payload.suggested_vram_gb,
    });
    return row.reload();
  }

  async dependencies(id, runtimeId) {
    const workflow = await this.show(id);
    const runtime = runtimeId
      ? await this.ctx.model.Runtime.findByPk(runtimeId)
      : await this.ctx.model.Runtime.findOne({ order: [[ 'id', 'ASC' ]] });
    if (!runtime) this.ctx.throw(404, '没有登记运行时');
    const snapshot = await this.ctx.service.probe.inspect(runtime.base_url, runtime.expected_version);
    const diff = this.ctx.service.probe.diff(
      snapshot,
      workflow.required_nodes,
      workflow.required_models,
      workflow.suggested_vram_gb,
    );
    const supplies = snapshot.online
      ? buildSupplies({
        missingNodes: diff.missing_nodes,
        requiredModels: workflow.required_models,
        installedModels: snapshot.models || [],
      })
      : { note: '', plugins: [], families: [], loose: [] };
    return {
      workflow_id: workflow.id,
      runtime_id: runtime.id,
      online: snapshot.online,
      version: snapshot.version,
      version_ok: snapshot.version_ok,
      error: snapshot.error,
      ...diff,
      supplies,
    };
  }
}

module.exports = WorkflowService;
