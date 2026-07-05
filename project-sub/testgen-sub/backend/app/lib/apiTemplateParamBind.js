'use strict';

/** @typedef {'context'|'query'|'body'|'path'|'header'} ParamBindTo */

const BIND_TO = {
  CONTEXT: 'context',
  QUERY: 'query',
  BODY: 'body',
  PATH: 'path',
  HEADER: 'header',
};

const METHODS_WITHOUT_BODY = new Set([ 'GET', 'DELETE', 'HEAD', 'OPTIONS' ]);

/**
 * 按 HTTP 方法与 URL 推断外部入参默认落点
 * @param {string} [httpMethod]
 * @param {string} key
 * @param {string} [urlPath]
 * @returns {ParamBindTo}
 */
function inferParamBindTo(httpMethod, key, urlPath = '/') {
  const path = String(urlPath || '');
  const k = String(key || '');
  if (path.includes(`:${k}`) || path.includes(`{${k}}`)) {
    return BIND_TO.PATH;
  }
  if (METHODS_WITHOUT_BODY.has(String(httpMethod || 'GET').toUpperCase())) {
    return BIND_TO.QUERY;
  }
  return BIND_TO.BODY;
}

/**
 * 将外部入参按 schema.bind_to 写入请求各部位（context 仅进变量池，不在此处理）
 * @param {{ headers: object, query: object, path: string, body: object }} parts
 * @param {object[]} schema input_params_schema
 * @param {Record<string, unknown>} values
 * @param {string} [httpMethod]
 * @param {string} [urlPath]
 * @param {(obj: object, path: string, value: unknown) => void} setJsonPath
 */
function applyInputParamBindings(parts, schema, values, httpMethod, urlPath, setJsonPath) {
  for (const row of schema || []) {
    if (!row?.key) continue;
    const val = values[row.key];
    if (val === undefined || val === null || val === '') continue;

    const bindTo = row.bind_to || inferParamBindTo(httpMethod, row.key, urlPath);
    if (bindTo === BIND_TO.CONTEXT || bindTo === 'var') continue;

    if (bindTo === BIND_TO.QUERY) {
      parts.query[row.key] = val;
    } else if (bindTo === BIND_TO.HEADER) {
      parts.headers[row.key] = String(val);
    } else if (bindTo === BIND_TO.PATH) {
      const encoded = encodeURIComponent(String(val));
      parts.path = parts.path
        .replace(`:${row.key}`, encoded)
        .replace(`{${row.key}}`, encoded);
    } else if (bindTo === BIND_TO.BODY) {
      setJsonPath(parts.body, row.json_path || row.key, val);
    }
  }
}

/**
 * 从 input_params 键值对生成 schema（导入用）
 * @param {Record<string, unknown>} inputParams
 * @param {string} [httpMethod]
 * @param {string} [urlPath]
 */
function schemaFromInputParams(inputParams = {}, httpMethod, urlPath) {
  return Object.entries(inputParams).map(([ key, defaultVal ]) => ({
    key,
    label: key,
    default: defaultVal,
    bind_to: inferParamBindTo(httpMethod, key, urlPath),
    json_path: key,
  }));
}

/** @param {object} obj @param {string} path @param {unknown} value */
function setJsonPath(obj, path, value) {
  if (!path || path === '.') return;
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const p = parts[i];
    const next = parts[i + 1];
    if (/^\d+$/.test(next)) {
      if (!Array.isArray(cur[p])) cur[p] = [];
    } else if (cur[p] == null || typeof cur[p] !== 'object') {
      cur[p] = {};
    }
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cur) && /^\d+$/.test(last)) {
    cur[Number(last)] = value;
  } else {
    cur[last] = value;
  }
}

function appendQueryToPath(path, query = {}) {
  const qs = new URLSearchParams();
  for (const [ k, v ] of Object.entries(query)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  const qstr = qs.toString();
  if (!qstr) return path;
  return path + (path.includes('?') ? '&' : '?') + qstr;
}

/**
 * 前置链路步骤：按 input_params + schema.bind_to 补全 body/query/path/header
 * @param {object} row 已做 {{var}} 插值后的步骤
 * @param {Record<string, unknown>} vars
 * @param {object[]} schema input_params_schema
 */
function applyStepInputParams(row, vars, schema = []) {
  const paramKeys = row.input_params;
  if (!Array.isArray(paramKeys) || !paramKeys.length) return row;

  const out = { ...row };
  const method = String(out.method || 'GET').toUpperCase();
  const schemaByKey = Object.fromEntries(
    (schema || []).filter(s => s?.key).map(s => [ s.key, s ]),
  );
  const subsetSchema = paramKeys.map(k => schemaByKey[k] || { key: k, json_path: k });

  const parts = {
    headers: { ...(out.headers || {}) },
    query: {},
    path: String(out.path || ''),
    body: out.body != null && typeof out.body === 'object'
      ? JSON.parse(JSON.stringify(out.body))
      : {},
  };

  applyInputParamBindings(parts, subsetSchema, vars, method, parts.path, setJsonPath);

  out.path = parts.path;
  if (Object.keys(parts.headers).length) out.headers = parts.headers;

  const extraQuery = { ...parts.query };
  for (const key of paramKeys) {
    const spec = schemaByKey[key] || {};
    const bindTo = spec.bind_to || inferParamBindTo(method, key, row.path);
    const val = vars[key];
    if (bindTo === BIND_TO.QUERY && val != null && val !== '') {
      extraQuery[key] = val;
    }
  }
  out.path = appendQueryToPath(out.path, extraQuery);

  if (!METHODS_WITHOUT_BODY.has(method)) {
    if (Object.keys(parts.body).length) {
      out.body = parts.body;
    } else {
      const autoBody = {};
      for (const key of paramKeys) {
        const spec = schemaByKey[key] || {};
        const bindTo = spec.bind_to || inferParamBindTo(method, key, row.path);
        const val = vars[key];
        if (bindTo === BIND_TO.BODY && val != null && val !== '') {
          setJsonPath(autoBody, spec.json_path || key, val);
        }
      }
      if (Object.keys(autoBody).length) out.body = autoBody;
    }
  }

  return out;
}

module.exports = {
  BIND_TO,
  inferParamBindTo,
  applyInputParamBindings,
  applyStepInputParams,
  schemaFromInputParams,
  setJsonPath,
  appendQueryToPath,
};
