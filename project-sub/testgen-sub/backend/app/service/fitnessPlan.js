'use strict';

const { stripIdPrefixFromLabel } = require('../../scripts/lib/display-field-rules');

class FitnessPlanService extends require('egg').Service {
  async list() {
    const { page = 1, pageSize = 20 } = this.ctx.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    const { count, rows } = await this.ctx.model.TestPlan.findAndCountAll({
      order: [[ 'created_at', 'DESC' ]],
      limit: Number(pageSize),
      offset,
    });

    const planIds = rows.map(r => r.id);
    let summaryByPlan = {};
    if (planIds.length) {
      const [ statsRows ] = await this.app.model.query(`
        SELECT p.id AS plan_id,
          COUNT(pi.id) AS total,
          SUM(CASE WHEN pir.result_status = 'passed' THEN 1 ELSE 0 END) AS passed,
          SUM(CASE WHEN pir.result_status IN ('passed', 'failed', 'skipped') THEN 1 ELSE 0 END) AS executed
        FROM test_plan p
        LEFT JOIN test_plan_item pi ON pi.plan_id = p.id
        LEFT JOIN test_plan_item_result pir
          ON pir.plan_id = p.id AND pir.plan_item_id = pi.id
        WHERE p.id IN (:planIds)
        GROUP BY p.id
      `, { replacements: { planIds } });
      summaryByPlan = Object.fromEntries(statsRows.map(r => {
        const total = Number(r.total) || 0;
        const passed = Number(r.passed) || 0;
        const executed = Number(r.executed) || 0;
        return [ r.plan_id, {
          item_count: total,
          passed_count: passed,
          executed_count: executed,
          pass_rate: total ? Math.round(100 * passed / total) : null,
          compliance_rate: executed ? Math.round(100 * passed / executed) : null,
        } ];
      }));
    }

    const list = rows.map(row => {
      const summary = summaryByPlan[row.id] || {};
      return {
        ...row.toJSON(),
        item_count: summary.item_count ?? 0,
        passed_count: summary.passed_count ?? 0,
        pass_rate: summary.pass_rate ?? null,
        compliance_rate: summary.compliance_rate ?? summary.pass_rate ?? null,
      };
    });

    return { list, total: count, page: Number(page), pageSize: Number(pageSize) };
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
        SELECT t.item_id, t.item_name, t.project_code,
          COALESCE(t.scheme_primary_id, cms.scheme_primary_id) AS scheme_primary_id
        FROM test_item_detail t
        LEFT JOIN test_category_minor_scheme cms ON cms.category_minor_id = t.category_minor_id
        WHERE t.item_id IN (:itemIds)
      `, { replacements: { itemIds } });
      schemeByItem = Object.fromEntries(rows.map(r => [ r.item_id, {
        scheme_primary_id: r.scheme_primary_id,
        item_name: stripIdPrefixFromLabel(r.item_id, r.item_name),
        project_code: r.project_code,
      } ]));
    }

    const enrichedItems = items.map(row => ({
      ...row.toJSON(),
      scheme_primary_id: schemeByItem[row.item_id]?.scheme_primary_id || null,
      item_name: schemeByItem[row.item_id]?.item_name || null,
      project_code: schemeByItem[row.item_id]?.project_code || null,
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
    const valid = (thresholds || []).filter(
      t => t.param_id && t.param_value !== undefined && t.param_value !== null && t.param_value !== '',
    );
    if (!valid.length) return;
    await this.ctx.model.TestPlanThreshold.bulkCreate(
      valid.map(t => ({ plan_id: planId, param_id: t.param_id, param_value: t.param_value, notes: t.notes })),
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
    const stats = await this.buildReportStats(plan);
    const content = this.buildReportMarkdown(plan, stats);
    await this.ctx.model.TestPlanReport.create({
      plan_id: planId,
      report_format: 'markdown',
      content,
    });
    return { content, plan, stats };
  }

  async exportPlanDocument(planId, format = 'markdown') {
    const plan = await this.findById(planId);
    if (!plan) return null;
    const stats = await this.buildReportStats(plan);
    if (format === 'html') {
      const content = this.buildPlanHtml(plan, stats);
      return { format: 'html', content, plan, stats };
    }
    if (format === 'plan') {
      const content = this.buildPlanMarkdown(plan, stats);
      return { format: 'markdown', content, plan, stats };
    }
    const content = this.buildReportMarkdown(plan, stats);
    return { format: 'markdown', content, plan, stats };
  }

  resolveThresholdActual(paramId, stats) {
    if (!paramId || !stats) return null;
    if (paramId.startsWith('rate_')) return stats.pass_rate;
    if (paramId.startsWith('block_')) {
      const total = stats.totals?.items || 0;
      const failed = stats.totals?.failed || 0;
      return total ? Math.round(100 * failed / total) : null;
    }
    if (paramId.startsWith('error_rate_')) {
      const total = stats.totals?.items || 0;
      const failed = stats.totals?.failed || 0;
      return total ? Math.round(100 * failed / total) : null;
    }
    return null;
  }

  async buildReportStats(plan) {
    const itemIds = (plan.items || []).map(i => i.item_id);
    let itemMeta = {};
    if (itemIds.length) {
      const [ rows ] = await this.app.model.query(`
        SELECT t.item_id, t.dimension_id, d.name AS dimension_name,
          COALESCE(t.scheme_primary_id, cms.scheme_primary_id) AS scheme_id,
          t.validation_primary_id AS validation_id,
          t.priority_id
        FROM test_item_detail t
        LEFT JOIN test_dimension d ON d.dimension_id = t.dimension_id
        LEFT JOIN test_category_minor_scheme cms ON cms.category_minor_id = t.category_minor_id
        WHERE t.item_id IN (:itemIds)
      `, { replacements: { itemIds } });
      itemMeta = Object.fromEntries(rows.map(r => [ r.item_id, r ]));
    }

    const byDimension = {};
    const byScheme = {};
    const byValidation = {};
    let passed = 0;
    let failed = 0;
    let pending = 0;

    for (const item of plan.items || []) {
      const meta = itemMeta[item.item_id] || {};
      const result = (plan.results || []).find(r => r.plan_item_id === item.id);
      const status = result?.result_status || 'pending';
      if (status === 'passed') passed += 1;
      else if (status === 'failed') failed += 1;
      else pending += 1;

      const dim = meta.dimension_name || meta.dimension_id || '未知';
      if (!byDimension[dim]) byDimension[dim] = { total: 0, passed: 0, failed: 0, pending: 0 };
      byDimension[dim].total += 1;
      byDimension[dim][status === 'passed' ? 'passed' : status === 'failed' ? 'failed' : 'pending'] += 1;

      const scheme = meta.scheme_id || '未知';
      if (!byScheme[scheme]) byScheme[scheme] = { total: 0, passed: 0 };
      byScheme[scheme].total += 1;
      if (status === 'passed') byScheme[scheme].passed += 1;

      const vs = meta.validation_id || '未知';
      if (!byValidation[vs]) byValidation[vs] = { total: 0, passed: 0 };
      byValidation[vs].total += 1;
      if (status === 'passed') byValidation[vs].passed += 1;
    }

    const passRate = plan.items?.length ? Math.round(100 * passed / plan.items.length) : 0;
    const thresholdCompare = (plan.thresholds || []).map(t => {
      const actual = this.resolveThresholdActual(t.param_id, {
        pass_rate: passRate,
        by_dimension: byDimension,
        by_scheme: byScheme,
        by_validation: byValidation,
        totals: { passed, failed, pending, items: plan.items?.length || 0 },
      });
      const configured = Number(t.param_value);
      let met = null;
      if (actual != null && Number.isFinite(configured)) {
        if (t.param_id.startsWith('block_')) met = actual <= configured;
        else if (t.param_id.startsWith('rate_')) met = actual >= configured;
        else if (t.param_id.startsWith('error_rate_')) met = actual <= configured;
        else if (t.param_id.startsWith('submit_p99_ms_') || t.param_id.startsWith('ttft_ms_')) {
          met = actual <= configured;
        }
      }
      return {
        param_id: t.param_id,
        configured: t.param_value,
        notes: t.notes,
        actual,
        met,
      };
    });

    const prdGoals = (plan.scope || [])
      .filter(s => s.scope_type === 'prd_goal')
      .map(s => s.scope_value);

    return {
      totals: {
        items: plan.items?.length || 0,
        passed,
        failed,
        pending,
        pass_rate: plan.items?.length ? Math.round(100 * passed / plan.items.length) : 0,
      },
      by_dimension: byDimension,
      by_scheme: byScheme,
      by_validation: byValidation,
      thresholds: thresholdCompare,
      prd_goals: prdGoals,
    };
  }

  buildPlanMarkdown(plan, stats) {
    const lines = [
      `# 测试计划 — ${plan.name}`,
      '',
      `- 版本: ${plan.version_tag || '-'}`,
      `- 环境: ${plan.env_name || '-'}`,
      `- 类型: ${plan.plan_type || 'release'}`,
      `- 用例数: ${stats.totals.items}`,
      '',
      '## PRD 目标范围',
      '',
      ...(stats.prd_goals.length
        ? stats.prd_goals.map(g => `- ${g}`)
        : [ '- （未指定）' ]),
      '',
      '## 阈值配置',
      '',
      ...(stats.thresholds.length
        ? stats.thresholds.map(t => `- ${t.param_id}: ${t.configured}${t.notes ? ` (${t.notes})` : ''}`)
        : [ '- （未配置）' ]),
      '',
      '## 发版放行标准',
      '',
      '- P0 阻塞项自动化覆盖率须达到计划阈值（默认 ≥ 95%）',
      '- 风险防护项无 GAP 状态',
      '- PRD 目标关联用例通过率 ≥ 计划阈值',
      '- 发版信号为 GREEN 或 YELLOW（RED 需豁免审批）',
      '- 计划内所有 P0 用例 verdict 为 pass，或已登记已知缺陷',
      '',
      '## 用例清单',
      '',
    ];
    for (const item of plan.items || []) {
      lines.push(`- ${item.item_id}`);
    }
    return lines.join('\n');
  }

  buildReportMarkdown(plan, stats) {
    const lines = [
      `# 测试完成报告 — ${plan.name}`,
      '',
      `- 版本: ${plan.version_tag || '-'}`,
      `- 环境: ${plan.env_name || '-'}`,
      `- 状态: ${plan.status}`,
      `- 通过率: ${stats.totals.pass_rate}% (${stats.totals.passed}/${stats.totals.items})`,
      '',
      '## 维度聚合',
      '',
    ];
    for (const [ dim, row ] of Object.entries(stats.by_dimension)) {
      const rate = row.total ? Math.round(100 * row.passed / row.total) : 0;
      lines.push(`- ${dim}: ${rate}% (${row.passed}/${row.total})`);
    }
    lines.push('', '## TS 方案聚合', '');
    for (const [ scheme, row ] of Object.entries(stats.by_scheme)) {
      const rate = row.total ? Math.round(100 * row.passed / row.total) : 0;
      lines.push(`- ${scheme}: ${rate}% (${row.passed}/${row.total})`);
    }
    lines.push('', '## VS 验证聚合', '');
    for (const [ vs, row ] of Object.entries(stats.by_validation)) {
      const rate = row.total ? Math.round(100 * row.passed / row.total) : 0;
      lines.push(`- ${vs}: ${rate}% (${row.passed}/${row.total})`);
    }
    if (stats.thresholds.length) {
      lines.push('', '## 阈值对比', '');
      for (const t of stats.thresholds) {
        const actualStr = t.actual != null ? `，实际 ${t.actual}` : '';
        const metStr = t.met === true ? ' ✓' : t.met === false ? ' ✗' : '';
        lines.push(`- ${t.param_id}: 配置 ${t.configured}${actualStr}${metStr}`);
      }
    }
    lines.push('', '## 执行明细', '');
    for (const item of plan.items) {
      const result = plan.results.find(r => r.plan_item_id === item.id);
      const runHint = result?.ft_run_id ? ` (run #${result.ft_run_id})` : '';
      lines.push(`- ${item.item_id}: ${result?.result_status || 'pending'}${runHint}`);
    }
    return lines.join('\n');
  }

  buildPlanHtml(plan, stats) {
    const md = this.buildPlanMarkdown(plan, stats);
    const escaped = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const body = escaped
      .split('\n')
      .map(line => {
        if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
        if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
        if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
        if (!line.trim()) return '';
        return `<p>${line}</p>`;
      })
      .join('\n');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${plan.name}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:24px auto;line-height:1.6}h1,h2{color:#303133}li{margin:4px 0}</style>
</head><body>${body}<p><em>导出时间 ${new Date().toISOString()}</em></p></body></html>`;
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
