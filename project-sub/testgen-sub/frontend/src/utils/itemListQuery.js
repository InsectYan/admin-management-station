/** 用例库列表筛选默认值（与 URL query 同步） */
export const FILTER_DEFAULTS = {
  project_code: '',
  generation_job_id: '',
  dimension_id: '',
  category_major_id: '',
  priority_id: '',
  scheme_primary_id: '',
  validation_primary_id: '',
  automation_status_id: '',
  station_id: '',
  role_scope_id: '',
  is_p0_blocker: false,
  is_risk_flag: false,
  keyword: '',
  preset: '',
};

export const FILTER_KEYS = Object.keys(FILTER_DEFAULTS);

/** 详情页导航上下文（非列表筛选） */
export const NAV_QUERY_KEYS = [ 'from', 'runId' ];

const DEFAULT_PAGE_SIZE = 20;

export function parseQueryFilters(q = {}) {
  const next = { ...FILTER_DEFAULTS };
  if (q.job_id && !q.generation_job_id) {
    next.generation_job_id = String(q.job_id);
  }
  for (const [ k, v ] of Object.entries(q)) {
    if (k in FILTER_DEFAULTS) {
      if (k === 'is_p0_blocker' || k === 'is_risk_flag') next[k] = v === 'true';
      else next[k] = v;
    }
  }
  return next;
}

export function parseListQuery(q = {}) {
  const filters = parseQueryFilters(q);
  const page = q.page ? Math.max(1, parseInt(String(q.page), 10) || 1) : 1;
  const pageSize = q.pageSize
    ? Math.max(1, parseInt(String(q.pageSize), 10) || DEFAULT_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  return {
    filters,
    page,
    pageSize,
    from: q.from ? String(q.from) : '',
    runId: q.runId ? String(q.runId) : '',
  };
}

/** 从任意 route.query 提取列表筛选 + 分页，用于返回列表时还原状态 */
export function pickListQuery(query = {}) {
  const { filters, page, pageSize } = parseListQuery(query);
  return buildListQuery(filters, page, pageSize);
}

export function buildListQuery(filters = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE, extra = {}) {
  const q = {};
  for (const [ k, v ] of Object.entries({ ...FILTER_DEFAULTS, ...filters })) {
    const empty = FILTER_DEFAULTS[k];
    if (typeof empty === 'boolean') {
      if (v !== empty) q[k] = 'true';
    } else if (v !== '' && v != null) {
      q[k] = String(v);
    }
  }
  if (page > 1) q.page = String(page);
  if (pageSize !== DEFAULT_PAGE_SIZE) q.pageSize = String(pageSize);
  return { ...q, ...extra };
}

/**
 * @param {string} itemId
 * @param {{ module?: string, query?: Record<string, string>, listQuery?: Record<string, string>, fromRun?: string|number }} [opts]
 */
export function buildItemDetailRoute(itemId, opts = {}) {
  const { module, query, listQuery, fromRun } = opts;
  let q = listQuery ? pickListQuery(listQuery) : pickListQuery(query || {});
  if (fromRun != null && fromRun !== '') {
    q = { ...q, from: 'run', runId: String(fromRun) };
  }
  const routeNames = {
    detail: 'fitness-item-detail',
    config: 'fitness-item-config',
    launch: 'fitness-item-launch',
    history: 'fitness-item-history',
  };
  const name = routeNames[module] || routeNames.detail;
  return {
    name,
    params: { itemId: String(itemId) },
    query: q,
  };
}

export function isFromRunConsole(query = {}) {
  return query.from === 'run' && Boolean(query.runId);
}

export function buildRunConsoleRoute(runId, query = {}) {
  return {
    name: 'fitness-run-console',
    params: { runId: String(runId) },
    query: pickListQuery(query),
  };
}
