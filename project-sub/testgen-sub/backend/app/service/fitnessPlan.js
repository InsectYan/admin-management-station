'use strict';

class FitnessPlanService extends require('egg').Service {
  async list() {
    const { page = 1, pageSize = 20 } = this.ctx.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    const { count, rows } = await this.ctx.model.TestPlan.findAndCountAll({
      order: [[ 'created_at', 'DESC' ]],
      limit: Number(pageSize),
      offset,
    });
    return { list: rows, total: count, page: Number(page), pageSize: Number(pageSize) };
  }

  async findById(id) {
    const plan = await this.ctx.model.TestPlan.findByPk(id);
    if (!plan) return null;
    const [ scope, thresholds, items, results ] = await Promise.all([
      this.ctx.model.TestPlanScope.findAll({ where: { plan_id: id } }),
      this.ctx.model.TestPlanThreshold.findAll({ where: { plan_id: id } }),
      this.ctx.model.TestPlanItem.findAll({ where: { plan_id: id }, order: [[ 'sort_order', 'ASC' ]] }),
      this.ctx.model.TestPlanItemResult.findAll({ where: { plan_id: id } }),
    ]);

    const itemIds = items.map(i => i.item_id);
    let schemeByItem = {};
    if (itemIds.length) {
      const [ rows ] = await this.app.model.query(`
        SELECT t.item_id,
          COALESCE(t.scheme_primary_id, cms.scheme_primary_id) AS scheme_primary_id
        FROM test_item_detail t
        LEFT JOIN test_category_minor_scheme cms ON cms.category_minor_id = t.category_minor_id
        WHERE t.item_id IN (:itemIds)
      `, { replacements: { itemIds } });
      schemeByItem = Object.fromEntries(rows.map(r => [ r.item_id, r.scheme_primary_id ]));
    }

    const enrichedItems = items.map(row => ({
      ...row.toJSON(),
      scheme_primary_id: schemeByItem[row.item_id] || null,
    }));

    return {
      ...plan.toJSON(),
      scope,
      thresholds,
      items: enrichedItems,
      results: results.map(r => r.toJSON()),
    };
  }

  async create(payload) {
    const { scope = [], thresholds = [], item_ids = [], ...planData } = payload;
    const plan = await this.ctx.model.TestPlan.create(planData);
    await this.syncScope(plan.id, scope);
    await this.syncThresholds(plan.id, thresholds);
    await this.syncItems(plan.id, item_ids);
    return this.findById(plan.id);
  }

  async update(id, payload) {
    const plan = await this.ctx.model.TestPlan.findByPk(id);
    if (!plan) return null;
    const { scope, thresholds, item_ids, ...planData } = payload;
    await plan.update(planData);
    if (scope) await this.syncScope(id, scope);
    if (thresholds) await this.syncThresholds(id, thresholds);
    if (item_ids) await this.syncItems(id, item_ids);
    return this.findById(id);
  }

  async syncScope(planId, scope) {
    await this.ctx.model.TestPlanScope.destroy({ where: { plan_id: planId } });
    if (!scope.length) return;
    await this.ctx.model.TestPlanScope.bulkCreate(
      scope.map(s => ({ plan_id: planId, scope_type: s.scope_type, scope_value: s.scope_value })),
    );
  }

  async syncThresholds(planId, thresholds) {
    await this.ctx.model.TestPlanThreshold.destroy({ where: { plan_id: planId } });
    if (!thresholds.length) return;
    await this.ctx.model.TestPlanThreshold.bulkCreate(
      thresholds.map(t => ({ plan_id: planId, param_id: t.param_id, param_value: t.param_value, notes: t.notes })),
    );
  }

  async syncItems(planId, itemIds) {
    await this.ctx.model.TestPlanItem.destroy({ where: { plan_id: planId } });
    if (!itemIds.length) return;
    await this.ctx.model.TestPlanItem.bulkCreate(
      itemIds.map((itemId, i) => ({ plan_id: planId, item_id: itemId, sort_order: i })),
    );
  }

  async saveResults(planId, results) {
    for (const row of results) {
      const [ record ] = await this.ctx.model.TestPlanItemResult.findOrCreate({
        where: { plan_id: planId, plan_item_id: row.plan_item_id },
        defaults: { result_status: 'pending' },
      });
      await record.update({
        result_status: row.result_status,
        validation_result: row.validation_result,
        notes: row.notes,
        defect_url: row.defect_url,
        ft_run_id: row.ft_run_id,
      });
    }
    return this.findById(planId);
  }

  async appendItems(id, itemIds = []) {
    const plan = await this.ctx.model.TestPlan.findByPk(id);
    if (!plan) return null;
    const existing = await this.ctx.model.TestPlanItem.findAll({
      where: { plan_id: id },
      order: [[ 'sort_order', 'ASC' ]],
    });
    const merged = existing.map(i => i.item_id);
    const set = new Set(merged);
    for (const itemId of itemIds) {
      if (itemId && !set.has(itemId)) {
        merged.push(itemId);
        set.add(itemId);
      }
    }
    await this.syncItems(id, merged);
    return this.findById(id);
  }

  async destroy(id) {
    const plan = await this.ctx.model.TestPlan.findByPk(id);
    if (!plan) return false;
    await this.ctx.model.TestPlanItemResult.destroy({ where: { plan_id: id } });
    await this.ctx.model.TestPlanItem.destroy({ where: { plan_id: id } });
    await this.ctx.model.TestPlanThreshold.destroy({ where: { plan_id: id } });
    await this.ctx.model.TestPlanScope.destroy({ where: { plan_id: id } });
    await this.ctx.model.TestPlanReport.destroy({ where: { plan_id: id } });
    await plan.destroy();
    return true;
  }

  async exportReport(planId) {
    const plan = await this.findById(planId);
    if (!plan) return null;
    const lines = [
      `# 测试完成报告 — ${plan.name}`,
      '',
      `- 版本: ${plan.version_tag || '-'}`,
      `- 环境: ${plan.env_name || '-'}`,
      `- 状态: ${plan.status}`,
      '',
      '## 执行结果',
      '',
    ];
    for (const item of plan.items) {
      const result = plan.results.find(r => r.plan_item_id === item.id);
      const runHint = result?.ft_run_id ? ` (run #${result.ft_run_id})` : '';
      lines.push(`- ${item.item_id}: ${result?.result_status || 'pending'}${runHint}`);
    }
    const content = lines.join('\n');
    await this.ctx.model.TestPlanReport.create({
      plan_id: planId,
      report_format: 'markdown',
      content,
    });
    return { content, plan };
  }

  async launchPlan(planId, body = {}) {
    const PlanBatchRunner = require('./execution/planBatchRunner');
    return new PlanBatchRunner(this.ctx).launchPlan(planId, body);
  }

  async getPlanRunSummary(planId) {
    const PlanBatchRunner = require('./execution/planBatchRunner');
    return new PlanBatchRunner(this.ctx).getPlanRunSummary(planId);
  }

  async summarizeReport(planId) {
    const plan = await this.findById(planId);
    if (!plan) return null;

    const observations = (plan.results || []).map(r => {
      const planItem = plan.items.find(i => i.id === r.plan_item_id);
      return {
        item_id: planItem?.item_id,
        result_status: r.result_status,
        validation_result: r.validation_result,
        notes: r.notes,
        ft_run_id: r.ft_run_id,
      };
    });

    const agentRes = await this.ctx.service.agentProxy.invokeFitnessJudge({
      action: 'summary',
      plan_id: planId,
      plan_name: plan.name,
      observations,
      trace: { plan_id: planId },
    });

    return {
      plan_id: planId,
      markdown: agentRes.output?.markdown || agentRes.reply || '',
      summary: agentRes.output,
      meta: agentRes.meta || {},
    };
  }
}

module.exports = FitnessPlanService;
