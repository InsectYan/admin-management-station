'use strict';

const Service = require('egg').Service;
const { applyMinorSchemeFallbackAll } = require('../lib/itemSchemeResolve');

class InternalFitnessService extends Service {
  async suggestItems(query = {}) {
    const { module, scheme_id, limit = 20 } = query;
    const cap = Math.min(Number(limit) || 20, 50);
    const whereParts = [ 't.is_active = TRUE' ];
    const replacements = { cap };

    if (module) {
      whereParts.push('t.category_major_id ILIKE :modulePat');
      replacements.modulePat = `%${module}%`;
    }
    if (scheme_id) {
      whereParts.push('(t.scheme_primary_id = :schemeId OR cms.scheme_primary_id = :schemeId)');
      replacements.schemeId = scheme_id;
    }

    const sql = `
      SELECT t.item_id, t.title, t.scheme_primary_id, t.validation_primary_id,
        t.test_input_example, t.expected_observation, t.automation_command
      FROM test_item_detail t
      LEFT JOIN test_category_minor_scheme cms ON cms.category_minor_id = t.category_minor_id
      WHERE ${whereParts.join(' AND ')}
      ORDER BY t.item_id ASC
      LIMIT :cap
    `;
    const [ rows ] = await this.app.model.query(sql, { replacements });
    return applyMinorSchemeFallbackAll(rows);
  }

  async bulkCreateSampleItems(body = {}) {
    const sampleSetId = body.sample_set_id;
    const items = body.items;
    if (!sampleSetId) {
      const err = new Error('sample_set_id is required');
      err.status = 400;
      throw err;
    }
    if (!Array.isArray(items) || !items.length) {
      const err = new Error('items must be a non-empty array');
      err.status = 400;
      throw err;
    }

    const set = await this.ctx.model.FtSampleSet.findByPk(sampleSetId);
    if (!set) {
      const err = new Error('样本集不存在');
      err.status = 404;
      throw err;
    }

    const existing = await this.ctx.model.FtSampleItem.count({
      where: { sample_set_id: sampleSetId },
    });

    const created = [];
    for (let i = 0; i < items.length; i += 1) {
      const row = items[i];
      const createdRow = await this.ctx.model.FtSampleItem.create({
        sample_set_id: sampleSetId,
        input_data: row.input_data || row,
        expected_data: row.expected_data || null,
        metadata: row.metadata || { source: 'agent' },
        sort_order: row.sort_order ?? existing + i,
      });
      created.push(createdRow);
    }

    const count = await this.ctx.service.fitnessExecution.syncSampleCount(sampleSetId);
    return { sample_set_id: sampleSetId, created_count: created.length, sample_count: count, items: created };
  }

  async patchItem(itemId, body = {}) {
    const [ rows ] = await this.app.model.query(
      `SELECT item_id FROM test_item_detail WHERE item_id = :itemId AND is_active = TRUE LIMIT 1`,
      { replacements: { itemId } },
    );
    if (!rows[0]) {
      const err = new Error('测试项不存在');
      err.status = 404;
      throw err;
    }

    const updates = [];
    const replacements = { itemId };
    if (body.expected_observation != null) {
      updates.push('expected_observation = :expectedObservation');
      replacements.expectedObservation = body.expected_observation;
    }
    if (body.execution_note != null) {
      updates.push('execution_note = :executionNote');
      replacements.executionNote = body.execution_note;
    }
    if (!updates.length) {
      const err = new Error('无有效更新字段');
      err.status = 400;
      throw err;
    }

    await this.app.model.query(
      `UPDATE test_item_detail SET ${updates.join(', ')} WHERE item_id = :itemId`,
      { replacements },
    );

    return { item_id: itemId, updated: Object.keys(body) };
  }

  async dryRunLaunch(itemId, body = {}) {
    const orchestrator = this.ctx.service.fitnessExecution.orchestrator();
    const result = await orchestrator.executeDryRun(itemId, body);
    return result;
  }
}

module.exports = InternalFitnessService;
