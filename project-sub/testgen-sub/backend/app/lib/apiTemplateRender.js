'use strict';

/**
 * 将 ft_api_template + 注入值渲染为可执行 HTTP 请求
 * @param {object} template
 * @param {Record<string, unknown>} injectValues
 */
function renderApiRequest(template, injectValues = {}) {
  const headers = { ...(template.headers_json || {}) };
  const query = { ...(template.query_json || {}) };
  let path = template.url_path || '/';
  let body = template.body_template != null
    ? JSON.parse(JSON.stringify(template.body_template))
    : {};

  for (const field of template.inject_schema || []) {
    const val = injectValues[field.key];
    if (val === undefined || val === null || val === '') continue;
    const loc = field.location || 'body';
    if (loc === 'header') {
      headers[field.key] = String(val);
    } else if (loc === 'query') {
      query[field.key] = val;
    } else if (loc === 'path') {
      path = path.replace(`:${field.key}`, encodeURIComponent(String(val)));
      path = path.replace(`{${field.key}}`, encodeURIComponent(String(val)));
    } else {
      setJsonPath(body, field.json_path || field.key, val);
    }
  }

  const qs = new URLSearchParams();
  for (const [ k, v ] of Object.entries(query)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  const qstr = qs.toString();
  if (qstr) path += (path.includes('?') ? '&' : '?') + qstr;

  return {
    method: (template.http_method || 'GET').toUpperCase(),
    path,
    headers,
    body,
  };
}

/** @param {object} obj @param {string} path @param {unknown} value */
function setJsonPath(obj, path, value) {
  if (!path || path === '.') return;
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * 解析 inject_bindings + 样本行 → 注入值 map
 * @param {object} bindings
 * @param {object} sampleRow input_data
 */
function resolveInjectValues(bindings = {}, sampleRow = {}) {
  const out = {};
  for (const [ key, spec ] of Object.entries(bindings)) {
    if (!spec || typeof spec !== 'object') continue;
    if (spec.mode === 'sample_set') {
      const fk = spec.field_key || key;
      out[key] = sampleRow[fk] ?? sampleRow[key];
    } else {
      out[key] = spec.value;
    }
  }
  return out;
}

/**
 * 展开执行矩阵：api_template + 样本集 → 多条 HTTP 请求
 * @param {object} template
 * @param {object} bindings
 * @param {object[]} sampleRows
 * @param {object} [manualOverrides]
 */
function expandApiTemplateRuns(template, bindings, sampleRows = [], manualOverrides = {}) {
  const bindingKeys = Object.keys(bindings || {});
  const needsSampleMatrix = bindingKeys.some(k => bindings[k]?.mode === 'sample_set');

  if (!needsSampleMatrix) {
    const injectValues = { ...resolveInjectValues(bindings, {}), ...manualOverrides };
    return [ renderApiRequest(template, injectValues) ];
  }

  const sampleBinding = bindingKeys.find(k => bindings[k]?.mode === 'sample_set');
  const setRows = sampleRows.length ? sampleRows : [ {} ];
  return setRows.map(row => {
    const rowData = row.input_data || row;
    const injectValues = {
      ...resolveInjectValues(bindings, rowData),
      ...manualOverrides,
    };
    return renderApiRequest(template, injectValues);
  });
}

module.exports = {
  renderApiRequest,
  resolveInjectValues,
  expandApiTemplateRuns,
  setJsonPath,
};
