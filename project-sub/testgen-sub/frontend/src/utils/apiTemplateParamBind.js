/** @typedef {'context'|'query'|'body'|'path'|'header'} ParamBindTo */

export const PARAM_BIND_OPTIONS = [
  { value: 'context', label: '变量池 context', hint: '供 {{key}}、前置链路使用，不直接写 HTTP' },
  { value: 'query', label: 'Query', hint: 'GET/DELETE 默认；拼到 ?key=value' },
  { value: 'body', label: 'Body', hint: 'POST/PUT/PATCH 默认；写入 JSON body' },
  { value: 'path', label: 'Path', hint: '替换 URL 中 :key 或 {key}' },
  { value: 'header', label: 'Header', hint: '写入请求头' },
];

const METHODS_WITHOUT_BODY = new Set([ 'GET', 'DELETE', 'HEAD', 'OPTIONS' ]);

/**
 * @param {string} [httpMethod]
 * @param {string} key
 * @param {string} [urlPath]
 * @returns {ParamBindTo}
 */
export function inferParamBindTo(httpMethod, key, urlPath = '/') {
  const path = String(urlPath || '');
  const k = String(key || '');
  if (path.includes(`:${k}`) || path.includes(`{${k}}`)) {
    return 'path';
  }
  if (METHODS_WITHOUT_BODY.has(String(httpMethod || 'GET').toUpperCase())) {
    return 'query';
  }
  return 'body';
}

export function bindToLabel(bindTo) {
  return PARAM_BIND_OPTIONS.find(o => o.value === bindTo)?.label || bindTo || 'body';
}

/**
 * @param {Record<string, unknown>} inputParams
 * @param {string} [httpMethod]
 * @param {string} [urlPath]
 */
export function schemaFromInputParams(inputParams = {}, httpMethod, urlPath) {
  return Object.entries(inputParams).map(([ key, defaultVal ]) => ({
    key,
    label: key,
    default: defaultVal,
    bind_to: inferParamBindTo(httpMethod, key, urlPath),
    json_path: key,
  }));
}

/**
 * 解析 TPL-API-CTX / 接口模板导入 JSON
 * @param {string} text
 */
export function parseApiTemplateImportJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? '').trim());
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : '格式无效'}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('须为 JSON 对象');
  }

  const out = {};
  const method = parsed.http_method || parsed.method;
  const urlPath = parsed.url_path || parsed.path || parsed.url;

  if (method) out.http_method = String(method).toUpperCase();
  if (urlPath) out.url_path = urlPath;
  if (parsed.headers_json) out.headers_json = parsed.headers_json;
  if (parsed.headers) out.headers_json = parsed.headers;
  if (parsed.query_json) out.query_json = parsed.query_json;
  if (parsed.query) out.query_json = parsed.query;
  if (parsed.body_template) out.body_template = parsed.body_template;
  if (parsed.body) out.body_template = parsed.body;
  if (Array.isArray(parsed.inject_schema)) out.inject_schema = parsed.inject_schema;
  if (Array.isArray(parsed.preflight_steps)) out.preflight_steps = parsed.preflight_steps;

  if (Array.isArray(parsed.input_params_schema)) {
    out.input_params_schema = parsed.input_params_schema.map(normalizeParamRow);
  } else if (parsed.input_params && typeof parsed.input_params === 'object' && !Array.isArray(parsed.input_params)) {
    out.input_params_schema = schemaFromInputParams(
      parsed.input_params,
      out.http_method || method,
      out.url_path || urlPath || '/',
    );
    out.input_params_defaults = parsed.input_params;
  }

  if (!out.input_params_schema?.length && !out.http_method && !out.url_path && !out.body_template) {
    throw new Error('未识别有效字段，支持 input_params / input_params_schema / body_template 等');
  }
  return out;
}

function normalizeParamRow(row) {
  if (typeof row === 'string') {
    return { key: row, label: row, bind_to: 'body', json_path: row };
  }
  return {
    key: row.key || '',
    label: row.label || row.key || '',
    default: row.default,
    bind_to: row.bind_to || 'body',
    json_path: row.json_path || row.key || '',
  };
}

/**
 * 用例页：仅导入 input_params 键值
 * @param {string} text
 */
export function parseInputParamsImportJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? '').trim());
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : '格式无效'}`);
  }
  if (parsed?.input_params && typeof parsed.input_params === 'object' && !Array.isArray(parsed.input_params)) {
    return { ...parsed.input_params };
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed);
    if (keys.length && keys.every(k => typeof parsed[k] !== 'object' || parsed[k] === null)) {
      return { ...parsed };
    }
  }
  throw new Error('须为 { "key": value } 或含 input_params 的对象');
}
