'use strict';

const Service = require('egg').Service;
const {
  assertContentType,
  defaultNodes,
  customCatalog,
  agentSpec,
  agentError,
  present,
} = require('../lib/pipelineDefaults');
const { profileEnabled } = require('../lib/modelGate');

function rowsOf(list) {
  return (list || []).map(item => (item.toJSON ? item.toJSON() : item));
}

class PipelineService extends Service {
  async show(contentType) {
    assertContentType(contentType);
    const [ nodes, agents ] = await Promise.all([
      this.ctx.model.PipelineNode.findAll({ where: { content_type: contentType }, order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]] }),
      this.ctx.model.AgentConfig.findAll({ where: { content_type: contentType } }),
    ]);
    return present(contentType, rowsOf(nodes), rowsOf(agents));
  }

  async addNode(payload) {
    const contentType = payload.content_type;
    assertContentType(contentType);
    const spec = customCatalog(contentType).find(item => item.node_key === payload.node_key);
    if (!spec) this.ctx.throw(400, '这个节点不能添加');
    const existing = await this.ctx.model.PipelineNode.findOne({
      where: { content_type: contentType, node_key: spec.node_key },
    });
    if (existing) this.ctx.throw(400, '这个节点已经在流水线里');
    const count = await this.ctx.model.PipelineNode.count({
      where: { content_type: contentType, kind: 'custom' },
    });
    await this.ctx.model.PipelineNode.create({
      content_type: contentType,
      node_key: spec.node_key,
      title: spec.title,
      kind: 'custom',
      sort_order: 100 + count,
      enabled: true,
      skill_name: '',
    });
    return this.show(contentType);
  }

  async updateNode(contentType, nodeKey, payload) {
    assertContentType(contentType);
    const enabled = Boolean(payload.enabled);
    const fixed = defaultNodes(contentType).find(item => item.node_key === nodeKey);
    if (fixed?.locked && !enabled) {
      this.ctx.throw(400, fixed.node_key === 'confirm' ? '人工确认不能关闭' : '这个节点不能关闭');
    }
    if (fixed) {
      const row = await this.ctx.model.PipelineNode.findOne({
        where: { content_type: contentType, node_key: nodeKey },
      });
      if (row) await row.update({ enabled, kind: 'fixed', title: fixed.title, skill_name: fixed.skill_name });
      else {
        await this.ctx.model.PipelineNode.create({
          content_type: contentType,
          node_key: nodeKey,
          title: fixed.title,
          kind: 'fixed',
          sort_order: 0,
          enabled,
          skill_name: fixed.skill_name,
        });
      }
      return this.show(contentType);
    }
    const row = await this.ctx.model.PipelineNode.findOne({
      where: { content_type: contentType, node_key: nodeKey, kind: 'custom' },
    });
    if (!row) this.ctx.throw(404, '节点不存在');
    await row.update({ enabled });
    return this.show(contentType);
  }

  async removeNode(contentType, nodeKey) {
    assertContentType(contentType);
    if (defaultNodes(contentType).some(item => item.node_key === nodeKey)) {
      this.ctx.throw(400, '不能删除这个节点');
    }
    const spec = customCatalog(contentType).find(item => item.node_key === nodeKey);
    if (!spec) this.ctx.throw(404, '节点不存在');
    const row = await this.ctx.model.PipelineNode.findOne({
      where: { content_type: contentType, node_key: nodeKey, kind: 'custom' },
    });
    if (!row) this.ctx.throw(404, '节点不存在');
    await row.destroy();
    return this.show(contentType);
  }

  async saveAgent(contentType, role, payload) {
    assertContentType(contentType);
    const spec = agentSpec(role);
    if (!spec) this.ctx.throw(400, '这个角色不存在');
    const draft = {
      input_text: String(payload.input_text || ''),
      output_text: String(payload.output_text || ''),
      model_profile: String(payload.model_profile || '').trim(),
      rule_text: String(payload.rule_text || ''),
      retry_count: Number(payload.retry_count),
      human_confirm: Boolean(payload.human_confirm),
      enabled: Boolean(payload.enabled),
    };
    const message = agentError(spec, draft);
    if (message) this.ctx.throw(400, message);
    if (draft.enabled && draft.model_profile) {
      const enabled = await profileEnabled(this.ctx, draft.model_profile);
      if (enabled === false) this.ctx.throw(400, '这个档位已停用');
    }
    const fields = { ...draft, content_type: contentType, role };
    const row = await this.ctx.model.AgentConfig.findOne({ where: { content_type: contentType, role } });
    if (row) await row.update(fields);
    else await this.ctx.model.AgentConfig.create(fields);
    return this.show(contentType);
  }
}

module.exports = PipelineService;
