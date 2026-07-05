'use strict';

const { interpolateValue } = require('../service/execution/runners/varPool');
const { applyInputParamBindings, setJsonPath } = require('./apiTemplateParamBind');

/**
 * 将 ft_api_template + 上下文变量 + 注入值渲染为可执行 HTTP 请求
 * @param {object} template
 * @param {Record<string, unknown>} injectValues inject_bindings 解析值
 * @param {Record<string, unknown>} [contextVars] 前置链路 extract + 外部入参
 */
function renderApiRequest(template, injectValues = {}, contextVars = {}) {
  const headers = interpolateValue({ ...(template.headers_json || {}) }, contextVars);
  const query = interpolateValue({ ...(template.query_json || {}) }, contextVars);
  let path = interpolateValue(String(template.url_path || '/'), contextVars);
  let body = template.body_template != null
    ? interpolateValue(JSON.parse(JSON.stringify(template.body_template)), contextVars)
    : {};

  const parts = { headers, query, path, body };
  applyInputParamBindings(
    parts,
    template.input_params_schema || [],
    contextVars,
    template.http_method,
    template.url_path,
    setJsonPath,
  );
  path = parts.path;
  body = parts.body;

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
      out[key] = sampleRow[fk] ?? sampleRow[key] ?? sampleRow.message ?? sampleRow.text;
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
 * @param {object} [contextVars]
 */
function expandApiTemplateRuns(template, bindings, sampleRows = [], contextVars = {}) {
  const bindingKeys = Object.keys(bindings || {});
  const needsSampleMatrix = bindingKeys.some(k => bindings[k]?.mode === 'sample_set');

  if (!needsSampleMatrix) {
    const injectValues = resolveInjectValues(bindings, {});
    return [ renderApiRequest(template, injectValues, contextVars) ];
  }

  const setRows = sampleRows.length ? sampleRows : [ {} ];
  return setRows.map(row => {
    const rowData = row.input_data || row;
    const injectValues = resolveInjectValues(bindings, rowData);
    return renderApiRequest(template, injectValues, contextVars);
  });
}

/**
 * 从 input_params_schema 解析默认值
 * @param {object[]} schema
 * @param {Record<string, unknown>} overrides
 */
function resolveInputParams(schema = [], overrides = {}) {
  const out = {};
  for (const row of schema) {
    if (!row?.key) continue;
    if (overrides[row.key] !== undefined && overrides[row.key] !== null && overrides[row.key] !== '') {
      out[row.key] = overrides[row.key];
    } else if (row.default !== undefined) {
      out[row.key] = row.default;
    }
  }
  return { ...out, ...overrides };
}

module.exports = {
  renderApiRequest,
  resolveInjectValues,
  expandApiTemplateRuns,
  resolveInputParams,
  setJsonPath,
};
