'use strict';

/** @param {unknown} obj @param {string} path */
function getByPath(obj, path) {
  if (!path || obj == null) return undefined;
  const parts = String(path).replace(/^\$\.?/, '').split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

/** @param {string} template @param {Record<string, unknown>} vars */
function interpolate(template, vars) {
  if (template == null) return template;
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

/** @param {unknown} value @param {Record<string, unknown>} vars */
function interpolateValue(value, vars) {
  if (typeof value === 'string') return interpolate(value, vars);
  if (Array.isArray(value)) return value.map(v => interpolateValue(v, vars));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [ k, v ] of Object.entries(value)) {
      out[k] = interpolateValue(v, vars);
    }
    return out;
  }
  return value;
}

/** @param {object} row @param {Record<string, unknown>} vars */
function applyVarsToRow(row, vars) {
  return interpolateValue(row, vars);
}

/** @param {Record<string, unknown>} vars @param {unknown} body @param {Record<string, string>} extract */
function applyExtract(vars, body, extract) {
  if (!extract || typeof extract !== 'object') return;
  for (const [ key, path ] of Object.entries(extract)) {
    const val = getByPath(body, path);
    if (val !== undefined) vars[key] = val;
  }
}

module.exports = {
  getByPath,
  interpolate,
  interpolateValue,
  applyVarsToRow,
  applyExtract,
};
