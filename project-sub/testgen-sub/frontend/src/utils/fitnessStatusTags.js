/**
 * 测试平台表格状态字段：中文标签 + el-tag 配色（单一数据源）
 *
 * 覆盖：执行/计划/结果状态、覆盖与发版信号、自动化、判定、布尔标志、风险关系等
 */

/** @typedef {'success'|'info'|'warning'|'danger'|'primary'|''} ElTagType */

/** @typedef {{ label: string, type?: ElTagType, color?: string, effect?: string, plainText?: boolean }} StatusTagDef */

/** @param {Record<string, StatusTagDef>} map @param {string} [effect] */
function withEffect(map, effect = 'plain') {
  return Object.fromEntries(
    Object.entries(map).map(([ k, v ]) => [ k, { effect, ...v } ]),
  );
}

export const EXECUTION_STATUS = withEffect({
  pending: { label: '等待中', type: 'info' },
  running: { label: '运行中', type: 'warning' },
  success: { label: '已完成', type: 'success' },
  failed: { label: '失败', type: 'danger' },
  cancelled: { label: '已取消', type: 'info' },
  not_run: { label: '未执行', type: '' },
});

export const PLAN_STATUS = withEffect({
  draft: { label: '草稿', type: 'info' },
  running: { label: '执行中', type: 'warning' },
  completed: { label: '已完成', type: 'success' },
  partial_failed: { label: '部分失败', type: 'warning' },
  failed: { label: '失败', type: 'danger' },
});

export const RUN_STATUS = EXECUTION_STATUS;

/** 通用 status 列（计划 / Run 等同列名） */
export const UNIFIED_STATUS = withEffect({
  ...EXECUTION_STATUS,
  draft: { label: '草稿', type: 'info' },
  completed: { label: '已完成', type: 'success' },
  partial_failed: { label: '部分失败', type: 'warning' },
});

export const RESULT_STATUS = withEffect({
  pending: { label: '待执行', type: 'warning' },
  passed: { label: '通过', type: 'success' },
  failed: { label: '失败', type: 'danger' },
  skipped: { label: '跳过', type: 'info' },
});

export const VERDICT_STATUS = withEffect({
  pass: { label: '通过', type: 'success' },
  fail: { label: '失败', type: 'danger' },
});

export const COVERAGE_STATUS = withEffect({
  COVERED: { label: '已覆盖', type: 'success' },
  PARTIAL: { label: '部分覆盖', type: 'warning' },
  GAP: { label: '缺口', type: 'danger' },
});

export const COVERAGE_NOTE = withEffect({
  OK: { label: '达标', type: 'success' },
  LOW: { label: '偏低', type: 'warning' },
  GAP: { label: '缺口', type: 'danger' },
});

export const RELEASE_SIGNAL = withEffect({
  GREEN: { label: '绿灯', type: 'success' },
  YELLOW: { label: '黄灯', type: 'warning' },
  RED: { label: '红灯', type: 'danger' },
});

export const AUTOMATION_STATUS = withEffect({
  AUTO_EXISTING: { label: '已有自动化', type: 'success' },
  AUTO_PARTIAL: { label: '部分自动化', type: 'warning' },
  AUTO_TODO: { label: '待建', type: 'danger' },
  AUTO_MANUAL: { label: '人工', type: 'info' },
});

export const RISK_RELATION_TAG = {
  GUARD: { label: '防护', type: 'success', effect: 'plain' },
  DETECT: { label: '检测', type: 'warning', effect: 'plain' },
  VERIFY: { label: '验证', type: 'info', effect: 'plain' },
  SYMPTOM: { label: '症状', type: 'danger', effect: 'plain' },
};

const BOOL_YES_NO = withEffect({
  true: { label: '是', type: 'success' },
  false: { label: '否', type: 'info' },
});

const BOOL_RISK = withEffect({
  true: { label: '是', type: 'danger' },
  false: { label: '否', type: 'info' },
});

const BOOL_PRIMARY = withEffect({
  true: { label: '主配对', type: 'success' },
  false: { label: '—', type: '', plainText: true },
});

/** 列 prop → 值映射表 */
const COLUMN_REGISTRY = {
  execution_status: EXECUTION_STATUS,
  execution_status_name: EXECUTION_STATUS,
  coverage_status: COVERAGE_STATUS,
  coverage_note: COVERAGE_NOTE,
  release_signal: RELEASE_SIGNAL,
  result_status: RESULT_STATUS,
  automation_status_id: AUTOMATION_STATUS,
  automation_status_name: AUTOMATION_STATUS,
  status_name: AUTOMATION_STATUS,
  verdict: VERDICT_STATUS,
  sub_verdict: VERDICT_STATUS,
  validation_result: VERDICT_STATUS,
  relation_type_id: RISK_RELATION_TAG,
  has_primary_guard: BOOL_YES_NO,
  is_risk_flag: BOOL_RISK,
  is_p0_blocker: BOOL_RISK,
  is_observability_audit: BOOL_YES_NO,
  is_active: BOOL_YES_NO,
  is_primary: BOOL_PRIMARY,
  enabled: BOOL_YES_NO,
  jaeger_reachable: BOOL_YES_NO,
};

/** 名称列优先用同行 id 字段取值 */
const PROP_VALUE_SOURCE = {
  execution_status_name: 'execution_status',
  automation_status_name: 'automation_status_id',
  status_name: 'automation_status_id',
};

const STATUS_PROPS = new Set(Object.keys(COLUMN_REGISTRY));

function normalizeKey(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

/** @param {Record<string, StatusTagDef>} map @param {unknown} value */
function lookupStatus(map, value) {
  const key = normalizeKey(value);
  if (!key && key !== 'false') return null;
  if (map[key]) return map[key];
  const upper = key.toUpperCase();
  if (map[upper]) return map[upper];
  const lower = key.toLowerCase();
  if (map[lower]) return map[lower];
  for (const def of Object.values(map)) {
    if (def.label === key) return def;
  }
  return null;
}

/** @param {string} prop @param {unknown} value */
function resolveStatusMap(prop, value) {
  if (prop === 'status') return UNIFIED_STATUS;
  return COLUMN_REGISTRY[prop] || null;
}

/** @param {string} prop @param {Record<string, unknown>} [row] */
function resolveCellValue(prop, row) {
  if (!row) return undefined;
  const sourceProp = PROP_VALUE_SOURCE[prop];
  if (sourceProp && row[sourceProp] != null && row[sourceProp] !== '') {
    return row[sourceProp];
  }
  return row[prop];
}

/** @param {string} prop @param {Record<string, unknown>} [row] */
export function isStatusColumn(prop, row) {
  if (!prop) return false;
  if (STATUS_PROPS.has(prop)) return true;
  if (prop === 'status') {
    const v = resolveCellValue(prop, row);
    if (v == null || v === '') return true;
    return !!lookupStatus(UNIFIED_STATUS, v);
  }
  return false;
}

/** @param {string} prop @param {Record<string, unknown>} [row] @param {unknown} [rawValue] */
export function statusCellLabel(prop, row, rawValue) {
  const value = rawValue !== undefined ? rawValue : resolveCellValue(prop, row);
  if (value == null || value === '') return '—';
  const map = resolveStatusMap(prop, value);
  if (!map) return String(value);
  const def = lookupStatus(map, value);
  return def?.label ?? String(value);
}

/** @param {string} prop @param {Record<string, unknown>} [row] @param {unknown} [rawValue] */
export function statusTagProps(prop, row, rawValue) {
  const value = rawValue !== undefined ? rawValue : resolveCellValue(prop, row);
  if (value == null || value === '') {
    return { label: '—', type: '', plainText: true };
  }
  const map = resolveStatusMap(prop, value);
  if (!map) {
    return { label: String(value), type: 'info', effect: 'plain' };
  }
  const def = lookupStatus(map, value);
  if (!def) {
    return { label: String(value), type: 'info', effect: 'plain' };
  }
  return {
    label: def.label,
    type: def.type ?? 'info',
    color: def.color,
    effect: def.effect ?? 'plain',
    plainText: def.plainText,
  };
}

/** @param {unknown} value */
export function executionStatusTagType(value) {
  return statusTagProps('execution_status', null, value).type || 'info';
}

/** @param {unknown} value */
export function planStatusTagType(value) {
  return statusTagProps('status', { status: value }, value).type || 'info';
}

/** @param {unknown} value */
export function resultStatusTagType(value) {
  return statusTagProps('result_status', null, value).type || 'warning';
}

/** @param {unknown} value */
export function coverageTagType(value) {
  return statusTagProps('coverage_note', null, value).type || 'info';
}

/** @param {unknown} value */
export function releaseSignalTagType(value) {
  return statusTagProps('release_signal', null, value).type || 'info';
}

/** @param {unknown} value */
export function runStatusTagType(value) {
  return statusTagProps('status', { status: value }, value).type || 'info';
}

/** @param {string} typeId */
export function riskRelationTag(typeId) {
  return RISK_RELATION_TAG[typeId] || { label: typeId, type: 'info', effect: 'plain' };
}

/** 供筛选器、导出等复用的中文选项 */
export const STATUS_FILTER_OPTIONS = {
  coverage_status: [
    { value: 'COVERED', label: '已覆盖' },
    { value: 'PARTIAL', label: '部分覆盖' },
    { value: 'GAP', label: '缺口' },
  ],
  result_status: [
    { value: 'pending', label: '待执行' },
    { value: 'passed', label: '通过' },
    { value: 'failed', label: '失败' },
    { value: 'skipped', label: '跳过' },
  ],
  plan_status: [
    { value: 'draft', label: '草稿' },
    { value: 'running', label: '执行中' },
    { value: 'completed', label: '已完成' },
    { value: 'partial_failed', label: '部分失败' },
    { value: 'failed', label: '失败' },
  ],
};
