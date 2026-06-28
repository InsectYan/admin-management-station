/** @typedef {'success'|'info'|'warning'|'danger'|''} ElTagType */

/** 维度 A–H → Tag 样式 */
const DIMENSION_TAG = {
  A: { type: 'primary', effect: 'plain' },
  B: { type: 'success', effect: 'plain' },
  C: { type: 'warning', effect: 'plain' },
  D: { color: '#7c3aed', effect: 'plain' },
  E: { type: 'danger', effect: 'plain' },
  F: { color: '#0891b2', effect: 'plain' },
  G: { type: 'info', effect: 'plain' },
  H: { color: '#0d9488', effect: 'plain' },
};

/** 大类编码前缀 → Tag 颜色（按维度族） */
const MAJOR_TAG = {
  A1: { color: '#2563eb', effect: 'light' },
  A2: { color: '#1d4ed8', effect: 'light' },
  A3: { color: '#3b82f6', effect: 'light' },
  A4: { color: '#60a5fa', effect: 'light' },
  A5: { color: '#1e40af', effect: 'light' },
  A6: { color: '#6366f1', effect: 'light' },
  B1: { color: '#16a34a', effect: 'light' },
  B2: { color: '#15803d', effect: 'light' },
  B3: { color: '#22c55e', effect: 'light' },
  B4: { color: '#4ade80', effect: 'light' },
  B5: { color: '#166534', effect: 'light' },
  B6: { color: '#059669', effect: 'light' },
  C1: { color: '#d97706', effect: 'light' },
  C2: { color: '#ea580c', effect: 'light' },
  C3: { color: '#f59e0b', effect: 'light' },
  C4: { color: '#b45309', effect: 'light' },
  E_RISK: { type: 'danger', effect: 'dark' },
};

/** 优先级 → Tag */
const PRIORITY_TAG = {
  P0: { type: 'danger', effect: 'dark' },
  P1: { type: 'warning', effect: 'plain' },
  P2: { type: 'info', effect: 'plain' },
  P3: { type: 'info', effect: 'light' },
};

/** 可执行环境 */
const EXEC_ENV_TAG = {
  EXEC_LOCAL: { color: '#64748b', effect: 'plain' },
  EXEC_TEST: { color: '#0284c7', effect: 'plain' },
  EXEC_BOTH: { color: '#7c3aed', effect: 'plain' },
};

/** 环境分层 */
const ENV_TIER_TAG = {
  TIER_ANY: { type: 'success', effect: 'plain' },
  TIER_LOCAL: { color: '#0d9488', effect: 'plain' },
  TIER_STAGING: { type: 'warning', effect: 'plain' },
  TIER_PROD_ONLY: { type: 'danger', effect: 'plain' },
};

/**
 * @param {Record<string, string>} map
 * @param {string} [key]
 * @param {{ type?: ElTagType, color?: string, effect?: string }} fallback
 */
function pickTagStyle(map, key, fallback = { type: 'info', effect: 'plain' }) {
  if (key && map[key]) return { ...map[key] };
  return { ...fallback };
}

/** @param {Record<string, unknown>} row */
export function dimensionTagProps(row) {
  const id = String(row.dimension_id || '');
  return pickTagStyle(DIMENSION_TAG, id);
}

/** @param {Record<string, unknown>} row */
export function categoryMajorTagProps(row) {
  const id = String(row.category_major_id || '');
  if (MAJOR_TAG[id]) return { ...MAJOR_TAG[id] };
  const dim = id.charAt(0);
  return pickTagStyle(DIMENSION_TAG, dim);
}

/** @param {Record<string, unknown>} row */
export function priorityTagProps(row) {
  const id = String(row.priority_id || '');
  return pickTagStyle(PRIORITY_TAG, id, { type: '', effect: 'plain' });
}

/** @param {Record<string, unknown>} row */
export function execEnvTagProps(row) {
  const id = String(row.exec_env_id || '');
  return pickTagStyle(EXEC_ENV_TAG, id);
}

/** @param {Record<string, unknown>} row */
export function envTierTagProps(row) {
  const id = String(row.env_tier_id || '');
  return pickTagStyle(ENV_TIER_TAG, id);
}

/** @param {Record<string, unknown>} row @param {'dimension'|'major'|'priority'|'exec_env'|'env_tier'} kind */
export function itemTagLabel(row, kind) {
  const map = {
    dimension: row.dimension_name || row.dimension_id,
    major: row.category_major_name || row.category_major_id,
    priority: row.priority_name || row.priority_id,
    exec_env: row.exec_env_name || row.exec_env_id,
    env_tier: row.env_tier_name || row.env_tier_id,
  };
  const v = map[kind];
  return v == null || v === '' ? '—' : String(v);
}
