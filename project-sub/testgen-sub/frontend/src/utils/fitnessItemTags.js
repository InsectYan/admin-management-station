/** @typedef {'success'|'info'|'warning'|'danger'|''} ElTagType */

import { formatCategoryDisplay } from './testCategoryDisplay.js';

/** 维度 S/B/Q/R → Tag 样式 */
const DIMENSION_TAG = {
  S: { type: 'primary', effect: 'plain' },
  B: { type: 'success', effect: 'plain' },
  Q: { type: 'warning', effect: 'plain' },
  R: { color: '#0891b2', effect: 'plain' },
};

/** 通用大类 T1–T12 */
const MAJOR_TAG = {
  T1: { color: '#2563eb', effect: 'light' },
  T2: { color: '#1d4ed8', effect: 'light' },
  T3: { color: '#16a34a', effect: 'light' },
  T4: { color: '#15803d', effect: 'light' },
  T5: { color: '#059669', effect: 'light' },
  T6: { type: 'danger', effect: 'plain' },
  T7: { color: '#7c3aed', effect: 'light' },
  T8: { color: '#0891b2', effect: 'plain' },
  T9: { color: '#0e7490', effect: 'plain' },
  T10: { color: '#d97706', effect: 'light' },
  T11: { color: '#0d9488', effect: 'light' },
  T12: { color: '#b45309', effect: 'light' },
};

const MAJOR_TO_DIM = {
  T1: 'S', T2: 'S', T7: 'S',
  T3: 'B', T4: 'B', T5: 'B',
  T6: 'Q', T10: 'Q', T12: 'Q',
  T8: 'R', T9: 'R', T11: 'R',
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
  const dim = MAJOR_TO_DIM[id] || String(row.dimension_id || '');
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

/** @param {Record<string, unknown>} row @param {'dimension'|'major'|'priority'|'exec_env'|'env_tier'|'category'} kind */
export function itemTagLabel(row, kind) {
  if (kind === 'major' || kind === 'category') {
    return formatCategoryDisplay(row.category_major_id, row.category_major_name);
  }
  const map = {
    dimension: row.dimension_name || row.dimension_id,
    priority: row.priority_name || row.priority_id,
    exec_env: row.exec_env_name || row.exec_env_id,
    env_tier: row.env_tier_name || row.env_tier_id,
  };
  const v = map[kind];
  return v == null || v === '' ? '—' : String(v);
}
