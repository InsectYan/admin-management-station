'use strict';

const Service = require('egg').Service;

const OPEN = [ 'queued', 'running', 'paused' ];
const DONE = [ 'completed', 'failed', 'cancelled' ];

class BatchService extends Service {
  async requireProject(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    if (![ 'ai_comic', 'ai_short', 'ai_science', 'ai_commerce' ].includes(project.content_type)) this.ctx.throw(400, '这个内容类型还没开放');
    return project;
  }

  async requireBatch(batchId) {
    const batch = await this.ctx.model.Batch.findByPk(batchId);
    if (!batch) this.ctx.throw(404, '批次不存在');
    return batch;
  }

  present(batch, items) {
    return {
      ...batch.toJSON(),
      items: items.map(item => (item.toJSON ? item.toJSON() : item)),
    };
  }

  async loadItems(batchId) {
    return this.ctx.model.BatchItem.findAll({
      where: { batch_id: batchId },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
  }

  async show(batchId) {
    const batch = await this.requireBatch(batchId);
    return this.present(batch, await this.loadItems(batchId));
  }

  async list(projectId) {
    await this.requireProject(projectId);
    const batches = await this.ctx.model.Batch.findAll({
      where: { project_id: projectId },
      order: [[ 'id', 'DESC' ]],
    });
    const result = [];
    for (const batch of batches) result.push(this.present(batch, await this.loadItems(batch.id)));
    return result;
  }

  async create(projectId, payload) {
    const project = await this.requireProject(projectId);
    const items = Array.isArray(payload.items) ? payload.items : null;
    if (!items || !items.length) this.ctx.throw(400, '先添加选题');
    if (items.length > 20) this.ctx.throw(400, '一次最多 20 条选题');
    const rules = await this.ctx.model.Rule.findAll({
      where: { content_type: project.content_type, enabled: true },
      order: [[ 'id', 'ASC' ]],
    });
    const batch = await this.ctx.model.Batch.create({
      project_id: project.id,
      status: 'queued',
      total: items.length,
      rule_snapshot: rules.map(rule => ({
        id: rule.id,
        kind: rule.kind,
        name: rule.name,
        body: rule.body,
        cost_cap: rule.cost_cap,
      })),
    });
    await this.ctx.model.BatchItem.bulkCreate(items.map((item, index) => ({
      batch_id: batch.id,
      sort_order: index,
      title: String(item.title || '').trim(),
      body: String(item.body || '').trim(),
      status: 'queued',
      error_message: '',
    })));
    return this.show(batch.id);
  }

  async recount(batch) {
    const items = await this.loadItems(batch.id);
    const successCount = items.filter(item => item.status === 'success').length;
    const failedCount = items.filter(item => item.status === 'failed').length;
    const breakpoint = items.filter(item => item.status !== 'queued').length;
    await batch.update({
      success_count: successCount,
      failed_count: failedCount,
      breakpoint_index: breakpoint,
    });
    return items;
  }

  async finish(batch) {
    const items = await this.recount(batch);
    if (items.some(item => item.status === 'queued')) return;
    await batch.update({ status: items.some(item => item.status === 'failed') ? 'failed' : 'completed' });
  }

  hitRule(text, snapshot) {
    for (const rule of snapshot || []) {
      if (rule.kind !== 'banned') continue;
      const terms = String(rule.body || '').split(/\n+/).map(item => item.trim()).filter(Boolean);
      if (terms.some(term => text.includes(term))) return rule.id;
    }
    return null;
  }

  async writeItem(project, item, snapshot) {
    const body = String(item.body || '').trim();
    if (!body) this.ctx.throw(400, '需要正文');
    const hit = this.hitRule(body, snapshot);
    if (hit) this.ctx.throw(400, `命中规则 ${hit}`);
    if (project.content_type === 'ai_science' || project.content_type === 'ai_commerce') {
      const count = await this.ctx.model.CopyBlock.count({ where: { project_id: project.id } });
      await this.ctx.model.CopyBlock.create({
        project_id: project.id,
        sort_order: count + 1,
        title: item.title || '选题',
        body,
      });
      return;
    }
    await this.ctx.service.project.addShot(project.id, {
      description: item.title ? `${item.title}：${body}` : body,
    });
  }

  async step(batchId) {
    const batch = await this.requireBatch(batchId);
    if (batch.status === 'paused') this.ctx.throw(400, '批次已暂停');
    if (batch.status === 'cancelled') this.ctx.throw(400, '批次已取消');
    if (DONE.includes(batch.status)) this.ctx.throw(400, '批次已经结束');
    const items = await this.loadItems(batch.id);
    const item = items.find(row => row.status === 'queued');
    if (!item) {
      await this.finish(batch);
      return this.show(batch.id);
    }
    await batch.update({ status: 'running' });
    const project = await this.requireProject(batch.project_id);
    try {
      await this.writeItem(project, item, batch.rule_snapshot || []);
      await item.update({ status: 'success', error_message: '' });
    } catch (err) {
      await item.update({ status: 'failed', error_message: err.message || '处理失败' });
    }
    await this.recount(batch);
    const fresh = await this.requireBatch(batch.id);
    if (fresh.status === 'paused' || fresh.status === 'cancelled') return this.show(batch.id);
    const left = await this.ctx.model.BatchItem.count({ where: { batch_id: batch.id, status: 'queued' } });
    if (!left) await this.finish(fresh);
    else await fresh.update({ status: 'queued' });
    return this.show(batch.id);
  }

  async run(batchId) {
    let view = null;
    for (let i = 0; i < 20; i += 1) {
      const batch = await this.requireBatch(batchId);
      if (batch.status === 'paused') this.ctx.throw(400, '批次已暂停');
      if (batch.status === 'cancelled') this.ctx.throw(400, '批次已取消');
      if (DONE.includes(batch.status) && i > 0) return this.show(batchId);
      if (DONE.includes(batch.status)) this.ctx.throw(400, '批次已经结束');
      view = await this.step(batchId);
      if ([ 'paused', 'cancelled', 'completed', 'failed' ].includes(view.status)) return view;
    }
    return view;
  }

  async pause(batchId) {
    const batch = await this.requireBatch(batchId);
    if (!OPEN.includes(batch.status) || batch.status === 'paused') this.ctx.throw(400, '批次不能暂停');
    await batch.update({ status: 'paused' });
    return this.show(batchId);
  }

  async resume(batchId) {
    const batch = await this.requireBatch(batchId);
    if (batch.status !== 'paused') this.ctx.throw(400, '批次没有暂停');
    const left = await this.ctx.model.BatchItem.count({ where: { batch_id: batch.id, status: 'queued' } });
    if (!left) await this.finish(batch);
    else await batch.update({ status: 'queued' });
    return this.show(batchId);
  }

  async cancel(batchId) {
    const batch = await this.requireBatch(batchId);
    if (DONE.includes(batch.status)) this.ctx.throw(400, '批次已经结束');
    await this.ctx.model.BatchItem.update(
      { status: 'cancelled' },
      { where: { batch_id: batch.id, status: 'queued' } },
    );
    await this.recount(batch);
    await batch.update({ status: 'cancelled' });
    return this.show(batchId);
  }
}

module.exports = BatchService;
