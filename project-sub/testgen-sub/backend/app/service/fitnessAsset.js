'use strict';

const {
  enrichRowsWithFkNames,
  getDisplayColumns,
  getTableMeta,
  loadDisplayLabels,
  paginateRows,
} = require('../lib/fitnessDisplay');
const {
  ITEM_SCHEME_FALLBACK_JOINS,
  ITEM_SCHEME_FALLBACK_SELECT,
  applyMinorSchemeFallback,
  applyMinorSchemeFallbackAll,
} = require('../lib/itemSchemeResolve');
const { applyResolvedTemplate } = require('../lib/configTemplateRegistry');

const ALLOWED_TABLES = new Set([
  'test_dimension', 'test_category_major', 'test_category_minor',
  'config_template_enum', 'test_category_major_template',
  'test_scheme_enum', 'test_validation_enum', 'test_scheme_validation_pair',
  'test_priority_enum', 'test_automation_status_enum', 'test_station_enum', 'test_role_enum',
  'config_env_enum', 'automation_entry_enum', 'test_exec_env_enum', 'test_env_tier_enum',
  'threshold_param_enum',
  'prd_goal', 'prd_reference', 'arch_reference',
  'test_item_prefix_scheme', 'test_item_relation_type_enum',
  'test_item_detail', 'test_item_prd_goal_link', 'test_item_prd_ref_link',
  'test_item_arch_ref_link', 'test_item_risk_link',
]);

const ALLOWED_VIEWS = new Set([
  'v_metric_dimension_summary', 'v_metric_prd_goal_coverage', 'v_metric_automation_coverage',
  'v_metric_risk_guard_coverage', 'v_metric_priority_distribution', 'v_metric_station_role_matrix',
  'v_analysis_release_readiness', 'v_analysis_risk_gap', 'v_analysis_scheme_validation_matrix',
  'v_analysis_dimension_automation', 'v_analysis_p0_blockers_todo',
  'v_risk_link_bidirectional',
]);

const ITEM_FILTER_KEYS = [
  'project_code',
  'generation_job_id',
  'dimension_id', 'category_major_id', 'category_minor_id', 'priority_id',
  'scheme_primary_id', 'validation_primary_id', 'automation_status_id',
  'station_id', 'role_scope_id', 'is_risk_flag', 'is_p0_blocker', 'is_observability_audit',
];

const ITEM_LIST_JOINS = `
  LEFT JOIN test_dimension d ON d.dimension_id = t.dimension_id
  LEFT JOIN test_category_major cm ON cm.category_major_id = t.category_major_id
  LEFT JOIN test_priority_enum p ON p.priority_id = t.priority_id
  LEFT JOIN test_scheme_enum ts ON ts.scheme_id = t.scheme_primary_id
  LEFT JOIN test_validation_enum vs ON vs.validation_id = t.validation_primary_id
  LEFT JOIN test_automation_status_enum ast ON ast.automation_status_id = t.automation_status_id
  LEFT JOIN test_station_enum st ON st.station_id = t.station_id
  LEFT JOIN test_role_enum rl ON rl.role_scope_id = t.role_scope_id
  LEFT JOIN test_exec_env_enum ee ON ee.exec_env_id = t.exec_env_id
  LEFT JOIN test_env_tier_enum et ON et.env_tier_id = t.env_tier_id
  LEFT JOIN test_category_major_template cmt ON cmt.category_major_id = t.category_major_id
  LEFT JOIN config_template_enum ct_map ON ct_map.template_code = cmt.template_code
  LEFT JOIN config_template_enum ct_scheme ON ct_scheme.scheme_id = t.scheme_primary_id
  ${ITEM_SCHEME_FALLBACK_JOINS}
`;

const ITEM_LIST_SELECT = `
  t.*,
  d.name AS dimension_name,
  cm.name AS category_major_name,
  p.name AS priority_name,
  ts.name AS scheme_primary_name,
  vs.name AS validation_primary_name,
  vs.rate_level AS validation_rate_level,
  ast.name AS automation_status_name,
  st.name AS station_name,
  rl.name AS role_scope_name,
  ee.name AS exec_env_name,
  et.name AS env_tier_name,
  cmt.template_code AS mapped_template_code,
  ct_map.name AS mapped_template_name,
  ct_scheme.template_code AS scheme_template_code,
  ct_scheme.name AS scheme_template_name,
  ${ITEM_SCHEME_FALLBACK_SELECT}
`;

const EXECUTION_STATUS_LABELS = {
  pending: '等待中',
  running: '运行中',
  success: '已完成',
  failed: '失败',
  cancelled: '已取消',
  not_run: '未执行',
};

/** @param {unknown} progress */
function pickPassRateFromProgress(progress) {
  if (!progress || typeof progress !== 'object') return null;
  for (const key of [ 'pass_rate', 'pass_pct', 'current_pass_rate', 'rate' ]) {
    if (progress[key] == null || progress[key] === '') continue;
    const n = Number(progress[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** @param {unknown} thresholdJson @param {string | null | undefined} rateLevel */
function pickTargetPassRate(thresholdJson, rateLevel) {
  if (!thresholdJson || typeof thresholdJson !== 'object' || !rateLevel) return null;
  const key = `rate_${rateLevel}`;
  const raw = thresholdJson[key] ?? thresholdJson[key.toLowerCase()];
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** @param {Record<string, unknown>} query */
function buildTestItemWhere(query) {
  const { keyword, preset } = query;
  const conditions = [ 't.is_active = TRUE' ];
  const replacements = {};
  let idx = 0;

  for (const key of ITEM_FILTER_KEYS) {
    if (query[key] !== undefined && query[key] !== '') {
      idx += 1;
      const param = `p${idx}`;
      conditions.push(`t.${key} = :${param}`);
      replacements[param] = query[key] === 'true' ? true : query[key] === 'false' ? false : query[key];
    }
  }

  if (keyword) {
    idx += 1;
    conditions.push('(t.item_id ILIKE :kw OR t.item_name ILIKE :kw OR t.detail_summary ILIKE :kw)');
    replacements.kw = `%${keyword}%`;
  }

  if (preset === 'coach_p0') {
    conditions.push(`t.dimension_id = 'C' AND t.category_major_id = 'C1' AND t.priority_id = 'P0'`);
  } else if (preset === 'member_boundary') {
    conditions.push(`t.category_major_id = 'C2' AND t.is_p0_blocker = TRUE`);
  } else if (preset === 'station_gate') {
    conditions.push(`t.station_id = 'S02'`);
  } else if (preset === 'auto_todo_p0') {
    conditions.push(`t.automation_status_id = 'AUTO_TODO' AND t.is_p0_blocker = TRUE`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, replacements };
}

function escapeCsvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

class FitnessAssetService extends require('egg').Service {
  async enrichItemsWithExecutionMetrics(rows) {
    if (!rows.length) return rows;

    const itemIds = rows.map(r => r.item_id);
    const [ latestRuns ] = await this.app.model.query(`
      SELECT DISTINCT ON (item_id) item_id, id AS ft_run_id, status, progress
      FROM ft_run
      WHERE item_id IN (:itemIds)
      ORDER BY item_id, created_at DESC
    `, { replacements: { itemIds } });

    const runByItem = Object.fromEntries(latestRuns.map(r => [ r.item_id, r ]));
    const runIds = latestRuns.map(r => r.ft_run_id).filter(Boolean);

    /** @type {Record<number, number | null>} */
    let passRateByRun = {};
    if (runIds.length) {
      const [ rateRows ] = await this.app.model.query(`
        SELECT ft_run_id,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE sub_verdict IN ('pass', 'success', 'ok'))
            / NULLIF(COUNT(*), 0)::numeric,
            2
          ) AS pass_rate
        FROM ft_run_result
        WHERE ft_run_id IN (:runIds)
        GROUP BY ft_run_id
      `, { replacements: { runIds } });
      passRateByRun = Object.fromEntries(
        rateRows.map(r => [ r.ft_run_id, r.pass_rate != null ? Number(r.pass_rate) : null ]),
      );
    }

    const [ configs ] = await this.app.model.query(`
      SELECT DISTINCT ON (fc.item_id) fc.item_id, fc.threshold_json
      FROM ft_run_config fc
      INNER JOIN test_item_detail t ON t.item_id = fc.item_id
      LEFT JOIN test_category_minor_scheme cms ON cms.category_minor_id = t.category_minor_id
      WHERE fc.item_id IN (:itemIds)
        AND fc.scheme_id = COALESCE(t.scheme_primary_id, cms.scheme_primary_id)
      ORDER BY fc.item_id, fc.updated_at DESC
    `, { replacements: { itemIds } });
    const configByItem = Object.fromEntries(configs.map(c => [ c.item_id, c.threshold_json ]));

    return rows.map(row => {
      const run = runByItem[row.item_id];
      const status = run?.status || 'not_run';
      const fromProgress = pickPassRateFromProgress(run?.progress);
      const fromResults = run ? passRateByRun[run.ft_run_id] : null;

      return {
        ...row,
        execution_status: status,
        execution_status_name: EXECUTION_STATUS_LABELS[status] || status,
        current_pass_rate: fromProgress ?? fromResults ?? null,
        target_pass_rate: pickTargetPassRate(configByItem[row.item_id], row.validation_rate_level),
      };
    });
  }

  assertTable(name) {
    if (!ALLOWED_TABLES.has(name)) {
      const err = new Error(`表 ${name} 不在允许列表`);
      err.status = 400;
      throw err;
    }
  }

  assertView(name) {
    if (!ALLOWED_VIEWS.has(name)) {
      const err = new Error(`视图 ${name} 不在允许列表`);
      err.status = 400;
      throw err;
    }
  }

  async listEnum(table, query = {}) {
    this.assertTable(table);
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const offset = (page - 1) * pageSize;

    const [ countRows ] = await this.app.model.query(`SELECT COUNT(*) AS total FROM "${table}"`);
    const total = Number(countRows[0]?.total || 0);

    const [ rows ] = await this.app.model.query(
      `SELECT * FROM "${table}" ORDER BY 1 LIMIT :limit OFFSET :offset`,
      { replacements: { limit: pageSize, offset } },
    );
    await enrichRowsWithFkNames(this.app.model, table, rows, this.app.baseDir);
    const meta = getTableMeta(table, this.app.baseDir);
    const columnKeys = rows.length
      ? Object.keys(rows[0])
      : Object.keys(meta?.columns || {});
    const columns = getDisplayColumns(table, columnKeys, this.app.baseDir);

    return { list: rows, total, page, pageSize, columns };
  }

  async getDisplayMeta(table) {
    if (table) {
      this.assertTable(table);
      const meta = getTableMeta(table, this.app.baseDir);
      return meta || { columns: {} };
    }
    return loadDisplayLabels(this.app.baseDir);
  }

  async queryView(viewName, query = {}) {
    this.assertView(viewName);
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;

    const [ rows ] = await this.app.model.query(`SELECT * FROM "${viewName}"`);
    await enrichRowsWithFkNames(this.app.model, viewName, rows, this.app.baseDir);
    const paged = paginateRows(rows, page, pageSize);
    paged.columns = rows.length
      ? getDisplayColumns(viewName, Object.keys(rows[0]), this.app.baseDir)
      : [];
    return paged;
  }

  async listTestItems(query = {}) {
    const { page = 1, pageSize = 20 } = query;
    const { where, replacements } = buildTestItemWhere(query);
    const offset = (Number(page) - 1) * Number(pageSize);
    replacements.limit = Number(pageSize);
    replacements.offset = offset;

    const countSql = `SELECT COUNT(*) AS total FROM test_item_detail t ${where}`;
    const [ countRows ] = await this.app.model.query(countSql, { replacements });
    const total = Number(countRows[0]?.total || 0);

    const listSql = `
      SELECT ${ITEM_LIST_SELECT}
      FROM test_item_detail t
      ${ITEM_LIST_JOINS}
      ${where}
      ORDER BY t.item_id
      LIMIT :limit OFFSET :offset
    `;
    const [ rows ] = await this.app.model.query(listSql, { replacements });
    const list = await this.enrichItemsWithExecutionMetrics(
      applyMinorSchemeFallbackAll(rows).map(applyResolvedTemplate),
    );
    return { list, total, page: Number(page), pageSize: Number(pageSize) };
  }

  async exportTestItems(query = {}) {
    const limit = Math.min(Number(query.limit) || 2000, 5000);
    const { where, replacements } = buildTestItemWhere(query);
    replacements.limit = limit;

    const listSql = `
      SELECT ${ITEM_LIST_SELECT}
      FROM test_item_detail t
      ${ITEM_LIST_JOINS}
      ${where}
      ORDER BY t.item_id
      LIMIT :limit
    `;
    const [ rows ] = await this.app.model.query(listSql, { replacements });
    const enriched = await this.enrichItemsWithExecutionMetrics(
      applyMinorSchemeFallbackAll(rows).map(applyResolvedTemplate),
    );

    const columns = [
      { key: 'item_id', label: '用例编码' },
      { key: 'item_name', label: '名称' },
      { key: 'dimension_name', label: '维度' },
      { key: 'category_major_name', label: '大类' },
      { key: 'priority_name', label: '优先级' },
      { key: 'scheme_primary_name', label: '主方案' },
      { key: 'validation_primary_name', label: '主验证' },
      { key: 'exec_env_name', label: '可执行环境' },
      { key: 'env_tier_name', label: '环境分层' },
      { key: 'execution_status_name', label: '执行状态' },
      { key: 'current_pass_rate', label: '当前达标率' },
      { key: 'target_pass_rate', label: '目标达标率' },
      { key: 'automation_status_name', label: '自动化' },
      { key: 'station_name', label: '六站' },
      { key: 'role_scope_name', label: '三端' },
      { key: 'automation_command', label: '自动化命令' },
    ];
    const header = columns.map(c => c.label).join(',');
    const lines = enriched.map(row => columns.map(c => {
      const v = row[c.key];
      if (c.key === 'current_pass_rate' || c.key === 'target_pass_rate') {
        return escapeCsvCell(v == null ? '' : `${v}%`);
      }
      return escapeCsvCell(v);
    }).join(','));
    const csv = `\uFEFF${[ header, ...lines ].join('\n')}`;

    return { list: enriched, csv, total: enriched.length };
  }

  async fetchRiskLinksForItem(itemId) {
    const viewSql = `SELECT * FROM v_risk_link_bidirectional
         WHERE source_item_id = :itemId OR target_item_id = :itemId`;
    const fallbackSql = `
      SELECT 'RISK_TO_MAIN' AS direction, risk_item_id AS source_item_id, main_item_id AS target_item_id,
        relation_type_id, risk_category, is_primary, description, link_id
      FROM test_item_risk_link
      WHERE risk_item_id = :itemId OR main_item_id = :itemId
      UNION ALL
      SELECT 'MAIN_TO_RISK' AS direction, main_item_id AS source_item_id, risk_item_id AS target_item_id,
        relation_type_id, risk_category, is_primary, '反向：' || description, link_id
      FROM test_item_risk_link
      WHERE risk_item_id = :itemId OR main_item_id = :itemId`;
    try {
      const [ rows ] = await this.app.model.query(viewSql, { replacements: { itemId } });
      await enrichRowsWithFkNames(this.app.model, 'v_risk_link_bidirectional', rows, this.app.baseDir);
      return rows;
    } catch (err) {
      if (!/v_risk_link_bidirectional/.test(String(err.message))) throw err;
      const [ rows ] = await this.app.model.query(fallbackSql, { replacements: { itemId } });
      await enrichRowsWithFkNames(this.app.model, 'v_risk_link_bidirectional', rows, this.app.baseDir);
      return rows;
    }
  }

  async getTestItem(itemId) {
    const [ rows ] = await this.app.model.query(
      `SELECT ${ITEM_LIST_SELECT},
        cn.name AS category_minor_name,
        ts2.name AS scheme_secondary_name,
        vs2.name AS validation_secondary_name
       FROM test_item_detail t
       ${ITEM_LIST_JOINS}
       LEFT JOIN test_category_minor cn ON cn.category_minor_id = t.category_minor_id
       LEFT JOIN test_scheme_enum ts2 ON ts2.scheme_id = t.scheme_secondary_id
       LEFT JOIN test_validation_enum vs2 ON vs2.validation_id = t.validation_secondary_id
       WHERE t.item_id = :itemId`,
      { replacements: { itemId } },
    );
    if (!rows.length) return null;

    const item = applyResolvedTemplate(applyMinorSchemeFallback(rows[0]));
    const [ prdGoals, prdRefs, archRefs, riskLinks ] = await Promise.all([
      this.app.model.query(
        `SELECT l.*, g.name AS goal_name FROM test_item_prd_goal_link l
         JOIN prd_goal g ON g.prd_goal_id = l.prd_goal_id WHERE l.item_id = :itemId`,
        { replacements: { itemId } },
      ).then(([ r ]) => r),
      this.app.model.query(
        `SELECT l.*, r.title FROM test_item_prd_ref_link l
         JOIN prd_reference r ON r.prd_ref_id = l.prd_ref_id WHERE l.item_id = :itemId`,
        { replacements: { itemId } },
      ).then(([ r ]) => r),
      this.app.model.query(
        `SELECT l.*, a.title FROM test_item_arch_ref_link l
         JOIN arch_reference a ON a.arch_ref_id = l.arch_ref_id WHERE l.item_id = :itemId`,
        { replacements: { itemId } },
      ).then(([ r ]) => r),
      this.fetchRiskLinksForItem(itemId),
    ]);

    return {
      ...item,
      links: { prdGoals, prdRefs, archRefs, riskLinks },
    };
  }

  async browseTree() {
    const [ dimensions ] = await this.app.model.query(
      `SELECT * FROM test_dimension ORDER BY sort_order`,
    );
    const [ majors ] = await this.app.model.query(
      `SELECT * FROM test_category_major ORDER BY dimension_id, sort_order`,
    );
    const [ minors ] = await this.app.model.query(
      `SELECT cn.*, COUNT(t.item_id)::int AS item_count
       FROM test_category_minor cn
       LEFT JOIN test_item_detail t ON t.category_minor_id = cn.category_minor_id AND t.is_active
       GROUP BY cn.category_minor_id, cn.category_major_id, cn.name, cn.sort_order, cn.description
       ORDER BY cn.category_major_id, cn.sort_order`,
    );
    return { dimensions, majors, minors };
  }

  async listSchemes(query = {}) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    const prefixKw = query.prefixKw || '';

    const [ schemes ] = await this.app.model.query(`SELECT * FROM test_scheme_enum ORDER BY scheme_id`);
    const [ validations ] = await this.app.model.query(`SELECT * FROM test_validation_enum ORDER BY validation_id`);
    const [ pairsRaw ] = await this.app.model.query(`SELECT * FROM test_scheme_validation_pair ORDER BY scheme_id`);
    await enrichRowsWithFkNames(this.app.model, 'test_scheme_validation_pair', pairsRaw, this.app.baseDir);

    const pairWhere = prefixKw ? `WHERE item_prefix ILIKE :kw` : '';
    const pairRepl = { limit: pageSize, offset, kw: `%${prefixKw}%` };
    const [ prefixCount ] = await this.app.model.query(
      `SELECT COUNT(*) AS total FROM test_item_prefix_scheme ${pairWhere}`,
      { replacements: pairRepl },
    );
    const [ prefixesRaw ] = await this.app.model.query(
      `SELECT * FROM test_item_prefix_scheme ${pairWhere} ORDER BY item_prefix LIMIT :limit OFFSET :offset`,
      { replacements: pairRepl },
    );
    await enrichRowsWithFkNames(this.app.model, 'test_item_prefix_scheme', prefixesRaw, this.app.baseDir);

    return {
      schemes,
      validations,
      pairs: pairsRaw,
      prefixes: prefixesRaw,
      prefixTotal: Number(prefixCount[0]?.total || 0),
      prefixPage: page,
      prefixPageSize: pageSize,
    };
  }

  async listRiskItems(query = {}) {
    const { coverage_status, page = 1, pageSize = 50 } = query;
    const conditions = [ 't.is_risk_flag = TRUE', 't.is_active = TRUE' ];
    const replacements = { limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize) };
    if (coverage_status) {
      conditions.push('m.coverage_status = :coverage_status');
      replacements.coverage_status = coverage_status;
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const countSql = `
      SELECT COUNT(*) AS total
      FROM test_item_detail t
      LEFT JOIN v_metric_risk_guard_coverage m ON m.risk_item_id = t.item_id
      ${where}
    `;
    const [ countRows ] = await this.app.model.query(countSql, { replacements });
    const total = Number(countRows[0]?.total || 0);

    const sql = `
      SELECT t.*, m.coverage_status, m.guard_count, m.detect_count
      FROM test_item_detail t
      LEFT JOIN v_metric_risk_guard_coverage m ON m.risk_item_id = t.item_id
      ${where}
      ORDER BY t.item_id
      LIMIT :limit OFFSET :offset
    `;
    const [ rows ] = await this.app.model.query(sql, { replacements });
    return { list: rows, total, page: Number(page), pageSize: Number(pageSize) };
  }

  async listRiskLinks(query = {}) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const [ rows ] = await this.app.model.query(`SELECT * FROM v_risk_link_bidirectional ORDER BY source_item_id`);
    await enrichRowsWithFkNames(this.app.model, 'v_risk_link_bidirectional', rows, this.app.baseDir);
    return paginateRows(rows, page, pageSize);
  }

  async deleteTestItem(itemId) {
    if (!itemId) {
      const err = new Error('item_id 不能为空');
      err.status = 400;
      throw err;
    }
    const [, meta] = await this.app.model.query(
      `UPDATE test_item_detail SET is_active = FALSE, updated_at = NOW()
       WHERE item_id = :itemId AND is_active = TRUE`,
      { replacements: { itemId } },
    );
    const deleted = meta?.rowCount ?? 0;
    if (!deleted) {
      const err = new Error('测试项不存在或已删除');
      err.status = 404;
      throw err;
    }
    return { deleted: 1, item_id: itemId };
  }

  async deleteTestItemsBatch(itemIds = []) {
    const ids = [ ...new Set(itemIds.map(id => String(id).trim()).filter(Boolean)) ];
    if (!ids.length) {
      const err = new Error('item_ids 不能为空');
      err.status = 400;
      throw err;
    }
    const [, meta] = await this.app.model.query(
      `UPDATE test_item_detail SET is_active = FALSE, updated_at = NOW()
       WHERE item_id IN (:ids) AND is_active = TRUE`,
      { replacements: { ids } },
    );
    return { deleted: meta?.rowCount ?? 0, item_ids: ids };
  }

  async deleteTestItemsByFilter(query = {}) {
    const { where, replacements } = buildTestItemWhere(query);
    const countSql = `SELECT COUNT(*) AS total FROM test_item_detail t ${where}`;
    const [ countRows ] = await this.app.model.query(countSql, { replacements });
    const total = Number(countRows[0]?.total || 0);
    if (!total) {
      return { deleted: 0, total: 0 };
    }
    const updateSql = `
      UPDATE test_item_detail t SET is_active = FALSE, updated_at = NOW()
      ${where}
    `;
    const [, meta] = await this.app.model.query(updateSql, { replacements });
    return { deleted: meta?.rowCount ?? total, total };
  }
}

module.exports = FitnessAssetService;
