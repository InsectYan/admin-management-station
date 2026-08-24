'use strict';

const { stripIdPrefixFromLabel } = require('../../scripts/lib/display-field-rules');

/**
 * 将 ft_run.status / verdict 映射为计划结果表同语义字段，供「用例最新」列展示。
 * @param {string|null|undefined} status
 * @param {string|null|undefined} verdict
 */
function mapFtRunToPlanResultFields(status, verdict) {
  if (!status) {
    return { result_status: null, validation_result: null };
  }
  const s = String(status).toLowerCase();
  if (s === 'pending' || s === 'running') {
    return { result_status: 'pending', validation_result: s === 'running' ? 'running' : null };
  }
  if (s === 'cancelled') {
    return { result_status: 'skipped', validation_result: 'cancelled' };
  }
  const v = verdict != null && verdict !== '' ? String(verdict).toLowerCase() : '';
  const passed = v === 'pass' || s === 'success';
  return {
    result_status: passed ? 'passed' : 'failed',
    validation_result: v || s,
  };
}

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
          t.expected_observation, t.test_input_example,
          t.latest_ft_run_id,
          lr.status AS latest_run_status,
          lr.verdict AS latest_run_verdict,
          COALESCE(t.scheme_primary_id, cms.scheme_primary_id) AS scheme_primary_id
        FROM test_item_detail t
        LEFT JOIN test_category_minor_scheme cms ON cms.category_minor_id = t.category_minor_id
        LEFT JOIN ft_run lr ON lr.id = t.latest_ft_run_id
        WHERE t.item_id IN (:itemIds)
      `, { replacements: { itemIds } });
      schemeByItem = Object.fromEntries(rows.map(r => {
        const latest = mapFtRunToPlanResultFields(r.latest_run_status, r.latest_run_verdict);
        return [ r.item_id, {
          scheme_primary_id: r.scheme_primary_id,
          item_name: stripIdPrefixFromLabel(r.item_id, r.item_name),
          project_code: r.project_code,
          expected_observation: r.expected_observation || null,
          test_input_example: r.test_input_example || null,
          latest_ft_run_id: r.latest_ft_run_id != null ? Number(r.latest_ft_run_id) : null,
          latest_result_status: latest.result_status,
          latest_validation_result: latest.validation_result,
        } ];
      }));
    }

    const enrichedItems = items.map(row => ({
      ...row.toJSON(),
      scheme_primary_id: schemeByItem[row.item_id]?.scheme_primary_id || null,
      item_name: schemeByItem[row.item_id]?.item_name || null,
      project_code: schemeByItem[row.item_id]?.project_code || null,
      expected_observation: schemeByItem[row.item_id]?.expected_observation || null,
      test_input_example: schemeByItem[row.item_id]?.test_input_example || null,
      latest_ft_run_id: schemeByItem[row.item_id]?.latest_ft_run_id ?? null,
      latest_result_status: schemeByItem[row.item_id]?.latest_result_status ?? null,
      latest_validation_result: schemeByItem[row.item_id]?.latest_validation_result ?? null,
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

  async exportReport(planId, options = {}) {
    const plan = await this.findById(planId);
    if (!plan) return null;
    const stats = await this.buildReportStats(plan);
    const content = this.buildReportMarkdown(plan, stats, options);
    await this.ctx.model.TestPlanReport.create({
      plan_id: planId,
      report_format: 'markdown',
      content,
    });
    return { content, plan, stats, filter: options };
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

  formatResultStatus(status) {
    const map = {
      passed: '通过',
      failed: '失败',
      skipped: '跳过',
      pending: '待执行',
    };
    return map[status] || status || '待执行';
  }

  formatPlanStatus(status) {
    const map = {
      draft: '草稿',
      ready: '就绪',
      running: '执行中',
      completed: '已完成',
      archived: '已归档',
      cancelled: '已取消',
    };
    return map[status] || status || '-';
  }

  /** 将绝对 URL 收成 path，拼成 `POST /api/xxx` */
  formatHttpPathLabel(method, pathOrUrl) {
    if (!pathOrUrl) return '';
    let path = String(pathOrUrl).trim();
    if (!path) return '';
    try {
      if (/^https?:\/\//i.test(path)) {
        const u = new URL(path);
        path = u.pathname + (u.search || '');
      }
    } catch { /* keep raw */ }
    // 已是 "POST /x" 形式
    const already = path.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/i);
    if (already) return `${already[1].toUpperCase()} ${already[2]}`;
    const m = String(method || 'GET').trim().toUpperCase() || 'GET';
    if (!path.startsWith('/')) path = `/${path}`;
    return `${m} ${path}`;
  }

  /** 从执行配置 / 用例元数据提取接口 path；非接口用例返回空串 */
  extractApiPathLabel(configJson, itemMeta = {}) {
    const cfg = configJson && typeof configJson === 'object' ? configJson : {};
    const pick = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      const path = obj.endpoint_path || obj.path || obj.url_path || obj.submit_path || null;
      if (!path) return null;
      const method = obj.http_method || obj.method || null;
      return { path, method };
    };

    let hit = pick(cfg);
    if (!hit && Array.isArray(cfg.matrix)) {
      for (const row of cfg.matrix) {
        hit = pick(row);
        if (hit) break;
      }
    }
    if (!hit && Array.isArray(cfg.pairs)) {
      for (const row of cfg.pairs) {
        hit = pick(row);
        if (hit) break;
      }
    }
    if (!hit && Array.isArray(cfg.steps)) {
      for (const row of cfg.steps) {
        hit = pick(row);
        if (hit) break;
      }
    }
    if (!hit && Array.isArray(cfg.cases)) {
      for (const row of cfg.cases) {
        hit = pick(row);
        if (hit) break;
      }
    }
    if (!hit) {
      hit = pick(itemMeta);
    }
    if (!hit) return '';
    // CLI-only 且无真实 path 时不展示
    if (/^(cli|command)$/i.test(String(cfg.runner || '')) && !String(hit.path).startsWith('/') && !/^https?:/i.test(hit.path)) {
      return '';
    }
    return this.formatHttpPathLabel(hit.method || itemMeta.http_method, hit.path);
  }

  /** 从执行摘要 `POST https://.../x` 回退解析 */
  extractApiPathFromInputSummary(summary) {
    if (!summary) return '';
    const s = String(summary).trim();
    const m = s.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/i);
    if (!m) return '';
    const target = m[2];
    if (!/^https?:\/\//i.test(target) && !target.startsWith('/')) return '';
    return this.formatHttpPathLabel(m[1], target);
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
        SELECT t.item_id, t.item_name, t.dimension_id, d.name AS dimension_name,
          t.expected_observation, t.test_input_example,
          t.endpoint_path, t.http_method,
          COALESCE(t.scheme_primary_id, cms.scheme_primary_id) AS scheme_id,
          t.validation_primary_id AS validation_id,
          t.priority_id
        FROM test_item_detail t
        LEFT JOIN test_dimension d ON d.dimension_id = t.dimension_id
        LEFT JOIN test_category_minor_scheme cms ON cms.category_minor_id = t.category_minor_id
        WHERE t.item_id IN (:itemIds)
      `, { replacements: { itemIds } });
      itemMeta = Object.fromEntries(rows.map(r => [ r.item_id, {
        ...r,
        item_name: stripIdPrefixFromLabel(r.item_id, r.item_name),
      } ]));
    }

    const configByItemId = {};
    if (itemIds.length) {
      try {
        const [ cfgRows ] = await this.app.model.query(`
          SELECT DISTINCT ON (item_id) item_id, config_json
          FROM ft_run_config
          WHERE item_id IN (:itemIds)
          ORDER BY item_id, id DESC
        `, { replacements: { itemIds } });
        for (const row of cfgRows) {
          configByItemId[row.item_id] = row.config_json || {};
        }
      } catch { /* ignore */ }
    }

    const thresholdNameById = {};
    const schemeNameById = {};
    const validationNameById = {};
    try {
      const [ enumRows ] = await this.app.model.query(
        'SELECT param_id, name, unit FROM threshold_param_enum',
      );
      for (const row of enumRows) {
        thresholdNameById[row.param_id] = {
          name: row.name || row.param_id,
          unit: row.unit || null,
        };
      }
    } catch {
      // enum 表异常时仍返回 param_id
    }
    try {
      const [ schemeRows ] = await this.app.model.query(
        'SELECT scheme_id, name FROM test_scheme_enum',
      );
      for (const row of schemeRows) {
        schemeNameById[row.scheme_id] = row.name || row.scheme_id;
      }
    } catch { /* ignore */ }
    try {
      const [ vsRows ] = await this.app.model.query(
        'SELECT validation_id, name FROM test_validation_enum',
      );
      for (const row of vsRows) {
        validationNameById[row.validation_id] = row.name || row.validation_id;
      }
    } catch { /* ignore */ }

    const runIds = (plan.results || [])
      .map(r => r.ft_run_id)
      .filter(Boolean);
    const runFailById = {};
    const runInputById = {};
    if (runIds.length) {
      const runs = await this.ctx.model.FtRun.findAll({
        where: { id: runIds },
        attributes: [ 'id', 'progress', 'verdict', 'status' ],
      });
      for (const run of runs) {
        const progress = run.progress || {};
        if (progress.error) runFailById[run.id] = String(progress.error);
      }
      const subRows = await this.ctx.model.FtRunResult.findAll({
        where: { ft_run_id: runIds },
        order: [[ 'ft_run_id', 'ASC' ], [ 'sub_index', 'ASC' ]],
      });
      const outputFallbackById = {};
      for (const sub of subRows) {
        if (runInputById[sub.ft_run_id] == null && sub.input_summary) {
          runInputById[sub.ft_run_id] = String(sub.input_summary);
        }
        if (outputFallbackById[sub.ft_run_id] == null && sub.output_summary) {
          outputFallbackById[sub.ft_run_id] = String(sub.output_summary);
        } else if (outputFallbackById[sub.ft_run_id] == null && sub.assertion_detail != null) {
          try {
            outputFallbackById[sub.ft_run_id] = typeof sub.assertion_detail === 'string'
              ? sub.assertion_detail
              : JSON.stringify(sub.assertion_detail);
          } catch {
            outputFallbackById[sub.ft_run_id] = String(sub.assertion_detail);
          }
        }
        if (!runFailById[sub.ft_run_id] && sub.sub_verdict && ![ 'pass', 'success', 'ok' ].includes(String(sub.sub_verdict).toLowerCase())) {
          if (sub.output_summary) {
            runFailById[sub.ft_run_id] = String(sub.output_summary);
          } else if (sub.assertion_detail != null) {
            try {
              runFailById[sub.ft_run_id] = typeof sub.assertion_detail === 'string'
                ? sub.assertion_detail
                : JSON.stringify(sub.assertion_detail);
            } catch {
              runFailById[sub.ft_run_id] = String(sub.assertion_detail);
            }
          }
        }
      }
      for (const runId of runIds) {
        if (!runFailById[runId] && outputFallbackById[runId]) {
          runFailById[runId] = outputFallbackById[runId];
        }
      }
    }

    const byDimension = {};
    const byScheme = {};
    const byValidation = {};
    let passed = 0;
    let failed = 0;
    let pending = 0;
    const executionRows = [];

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

      const schemeId = meta.scheme_id || '未知';
      const scheme = schemeNameById[schemeId] || schemeId;
      if (!byScheme[scheme]) byScheme[scheme] = { total: 0, passed: 0, scheme_id: schemeId };
      byScheme[scheme].total += 1;
      if (status === 'passed') byScheme[scheme].passed += 1;

      const vsId = meta.validation_id || '未知';
      const vs = validationNameById[vsId] || vsId;
      if (!byValidation[vs]) byValidation[vs] = { total: 0, passed: 0, validation_id: vsId };
      byValidation[vs].total += 1;
      if (status === 'passed') byValidation[vs].passed += 1;

      const ftRunId = result?.ft_run_id || null;
      let inputJson = runInputById[ftRunId] || meta.test_input_example || item.test_input_example || '';
      if (inputJson && typeof inputJson === 'object') {
        try { inputJson = JSON.stringify(inputJson); } catch { inputJson = String(inputJson); }
      }
      let failReason = '';
      if (status === 'failed' || status === 'skipped') {
        failReason = result?.notes
          || runFailById[ftRunId]
          || result?.validation_result
          || '';
      }

      const apiPath = this.extractApiPathLabel(configByItemId[item.item_id], meta)
        || this.extractApiPathFromInputSummary(inputJson)
        || '';

      executionRows.push({
        plan_item_id: item.id,
        item_id: item.item_id,
        item_name: meta.item_name || item.item_name || item.item_id,
        expected_observation: meta.expected_observation || item.expected_observation || '',
        input_json: inputJson ? String(inputJson) : '',
        api_path: apiPath,
        fail_reason: failReason ? String(failReason) : '',
        result_status: status,
        validation_result: result?.validation_result || '',
        notes: result?.notes || '',
        ft_run_id: ftRunId,
        dimension: dim,
        scheme_id: schemeId,
        scheme_name: scheme,
        validation_id: vsId,
        validation_name: vs,
        result_status_label: this.formatResultStatus(status),
      });
    }

    const passRate = plan.items?.length ? Math.round(100 * passed / plan.items.length) : 0;
    const plainThresholds = (plan.thresholds || []).map(t => (typeof t.toJSON === 'function' ? t.toJSON() : t));
    const thresholdCompare = plainThresholds.map(t => {
      const paramId = t.param_id;
      const actual = this.resolveThresholdActual(paramId, {
        pass_rate: passRate,
        by_dimension: byDimension,
        by_scheme: byScheme,
        by_validation: byValidation,
        totals: { passed, failed, pending, items: plan.items?.length || 0 },
      });
      const configured = Number(t.param_value);
      let met = null;
      if (actual != null && Number.isFinite(configured)) {
        if (String(paramId).startsWith('block_')) met = actual <= configured;
        else if (String(paramId).startsWith('rate_')) met = actual >= configured;
        else if (String(paramId).startsWith('error_rate_')) met = actual <= configured;
        else if (String(paramId).startsWith('submit_p99_ms_') || String(paramId).startsWith('ttft_ms_')) {
          met = actual <= configured;
        }
      }
      const enumMeta = thresholdNameById[paramId] || {};
      return {
        param_id: paramId,
        param_name: enumMeta.name || paramId,
        unit: enumMeta.unit || null,
        configured: t.param_value,
        notes: t.notes,
        actual,
        met,
        met_label: met === true ? '达标' : met === false ? '未达标' : '—',
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
      execution_rows: executionRows,
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

  buildReportMarkdown(plan, stats, options = {}) {
    const statusFilter = Array.isArray(options.result_statuses)
      ? options.result_statuses.filter(Boolean)
      : [];
    const filterActive = statusFilter.length > 0
      && statusFilter.length < 4; // 未选齐四类则按筛选；全选等同不过滤

    const lines = [
      `# 测试完成报告 — ${plan.name}`,
      '',
      `- 版本: ${plan.version_tag || '-'}`,
      `- 环境: ${plan.env_name || '-'}`,
      `- 状态: ${this.formatPlanStatus(plan.status)}`,
      `- 通过率: ${stats.totals.pass_rate}%（通过 ${stats.totals.passed} / 共 ${stats.totals.items}）`,
    ];
    if (filterActive) {
      const labels = statusFilter.map(s => this.formatResultStatus(s)).join('、');
      lines.push(`- 执行明细筛选: ${labels}`);
    }
    lines.push('', '## 测试层级通过率', '');
    for (const [ dim, row ] of Object.entries(stats.by_dimension || {})) {
      const rate = row.total ? Math.round(100 * row.passed / row.total) : 0;
      lines.push(`- ${dim}: ${rate}%（通过 ${row.passed}/${row.total}）`);
    }
    lines.push('', '## TS 方案通过率', '');
    for (const [ scheme, row ] of Object.entries(stats.by_scheme || {})) {
      const rate = row.total ? Math.round(100 * row.passed / row.total) : 0;
      lines.push(`- ${scheme}: ${rate}%（通过 ${row.passed}/${row.total}）`);
    }
    lines.push('', '## VS 验证通过率', '');
    for (const [ vs, row ] of Object.entries(stats.by_validation || {})) {
      const rate = row.total ? Math.round(100 * row.passed / row.total) : 0;
      lines.push(`- ${vs}: ${rate}%（通过 ${row.passed}/${row.total}）`);
    }
    if (stats.thresholds?.length) {
      lines.push('', '## 阈值对比', '');
      for (const t of stats.thresholds) {
        const label = t.param_name || t.param_id;
        const unitHint = t.unit === 'percent' || String(t.param_id || '').startsWith('rate_')
          || String(t.param_id || '').startsWith('block_') || String(t.param_id || '').startsWith('error_rate_')
          ? '%'
          : (t.unit === 'ms' ? 'ms' : '');
        const actualStr = t.actual != null ? `，实际 ${t.actual}${unitHint}` : '';
        const metStr = t.met === true ? '，达标' : t.met === false ? '，未达标' : '';
        const notesStr = t.notes ? `（${t.notes}）` : '';
        lines.push(`- ${label}: 计划配置 ${t.configured}${unitHint}${actualStr}${metStr}${notesStr}`);
      }
    }
    lines.push('', '## 执行明细', '');
    let execRows = stats.execution_rows?.length
      ? [ ...stats.execution_rows ]
      : (plan.items || []).map(item => {
        const result = (plan.results || []).find(r => Number(r.plan_item_id) === Number(item.id));
        return {
          item_id: item.item_id,
          item_name: item.item_name || item.item_id,
          expected_observation: item.expected_observation || '',
          input_json: item.test_input_example || '',
          api_path: '',
          fail_reason: result?.notes || '',
          result_status: result?.result_status || 'pending',
          validation_result: result?.validation_result || '',
          scheme_name: '',
          validation_name: '',
          ft_run_id: result?.ft_run_id || null,
        };
      });
    if (filterActive) {
      const allow = new Set(statusFilter);
      execRows = execRows.filter(r => allow.has(r.result_status || 'pending'));
      lines.push(`（共 ${execRows.length} 条，已按结果筛选）`, '');
    }
    if (!execRows.length) {
      lines.push('- （无匹配用例）', '');
    }
    for (const row of execRows) {
      lines.push(`### ${row.item_name || row.item_id}`);
      lines.push(`- 结果: ${row.result_status_label || this.formatResultStatus(row.result_status)}`);
      if (row.scheme_name) lines.push(`- 测试方案: ${row.scheme_name}`);
      if (row.validation_name || row.validation_result) {
        lines.push(`- 验证判定: ${row.validation_name || row.validation_result}`);
      }
      if (row.api_path) lines.push(`- 接口: ${row.api_path}`);
      if (row.expected_observation) lines.push(`- 期望: ${row.expected_observation}`);
      if (row.input_json) {
        lines.push('- 入参:');
        lines.push('```json');
        lines.push(String(row.input_json));
        lines.push('```');
      }
      if (row.fail_reason) {
        lines.push('- 失败原因:');
        lines.push('```');
        lines.push(String(row.fail_reason));
        lines.push('```');
      }
      lines.push('');
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
