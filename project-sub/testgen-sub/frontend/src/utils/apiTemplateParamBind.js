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

/** 接口模板完整配置导出格式标识 */
export const API_TEMPLATE_CONFIG_FORMAT = 'testgen-api-template';
export const API_TEMPLATE_CONFIG_VERSION = 1;

/**
 * 构建可往返导入的接口模板配置 JSON
 * @param {Record<string, unknown>} data
 */
export function buildApiTemplateConfigJson(data = {}) {
  return {
    _format: API_TEMPLATE_CONFIG_FORMAT,
    _version: API_TEMPLATE_CONFIG_VERSION,
    template_code: data.template_code || '',
    name: data.name || '',
    description: data.description || '',
    project_code: data.project_code || '',
    http_method: String(data.http_method || 'POST').toUpperCase(),
    url_path: data.url_path || '/',
    expect_status: Number(data.expect_status) || 202,
    headers_json: data.headers_json && typeof data.headers_json === 'object' ? data.headers_json : {},
    query_json: data.query_json && typeof data.query_json === 'object' ? data.query_json : {},
    body_template: data.body_template && typeof data.body_template === 'object' ? data.body_template : {},
    inject_schema: Array.isArray(data.inject_schema) ? data.inject_schema : [],
    input_params_schema: Array.isArray(data.input_params_schema) ? data.input_params_schema : [],
    preflight_steps: Array.isArray(data.preflight_steps) ? data.preflight_steps : [],
    forbidden_patterns: Array.isArray(data.forbidden_patterns) ? data.forbidden_patterns : [],
    poll_json: data.poll_json && typeof data.poll_json === 'object' ? data.poll_json : {},
    export_schema: Array.isArray(data.export_schema) ? data.export_schema : [],
  };
}

/**
 * 解析 TPL-API-CTX / 接口模板导入 JSON（支持完整配置与局部字段）
 * @param {string} text
 */
export function parseApiTemplateImportJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? '').trim());
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : '格式无效'}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('须为 JSON 对象');
  }

  const out = {};
  const method = parsed.http_method || parsed.method;
  const urlPath = parsed.url_path || parsed.path || parsed.url;

  if (parsed.template_code) out.template_code = String(parsed.template_code).trim();
  if (parsed.name) out.name = String(parsed.name).trim();
  if (parsed.description != null) out.description = String(parsed.description);
  if (parsed.project_code != null) out.project_code = String(parsed.project_code).trim();
  if (method) out.http_method = String(method).toUpperCase();
  if (urlPath) out.url_path = urlPath;
  if (parsed.expect_status != null) out.expect_status = Number(parsed.expect_status) || 202;
  if (parsed.headers_json) out.headers_json = parsed.headers_json;
  if (parsed.headers) out.headers_json = parsed.headers;
  if (parsed.query_json) out.query_json = parsed.query_json;
  if (parsed.query) out.query_json = parsed.query;
  if (parsed.body_template) out.body_template = parsed.body_template;
  if (parsed.body) out.body_template = parsed.body;
  if (Array.isArray(parsed.inject_schema)) out.inject_schema = parsed.inject_schema;
  if (Array.isArray(parsed.preflight_steps)) out.preflight_steps = parsed.preflight_steps;
  if (Array.isArray(parsed.export_schema)) out.export_schema = parsed.export_schema;
  if (Array.isArray(parsed.forbidden_patterns)) {
    out.forbidden_patterns = parsed.forbidden_patterns.map(s => String(s).trim()).filter(Boolean);
  }
  if (parsed.poll_json && typeof parsed.poll_json === 'object') out.poll_json = parsed.poll_json;

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

  const isFullExport = parsed._format === API_TEMPLATE_CONFIG_FORMAT;
  const hasPartialFields = Boolean(
    out.input_params_schema?.length
    || out.http_method
    || out.url_path
    || out.body_template
    || out.inject_schema?.length
    || out.preflight_steps?.length,
  );
  const hasMetaFields = Boolean(out.name || out.template_code);

  if (!isFullExport && !hasPartialFields && !hasMetaFields) {
    throw new Error('未识别有效字段，支持完整配置（_format）或 input_params / body_template 等');
  }
  if (isFullExport && !out.name && !out.template_code && !out.url_path) {
    throw new Error('完整配置缺少 name、template_code 或 url_path');
  }
  return out;
}

/** @param {ReturnType<typeof parseApiTemplateImportJson>} imported @param {string} httpMethod @param {string} urlPath */
export function normalizeImportedInputParamsSchema(imported, httpMethod, urlPath) {
  if (!imported.input_params_schema?.length) return [];
  return imported.input_params_schema.map(p => ({
    ...p,
    bind_to: p.bind_to || inferParamBindTo(httpMethod, p.key, urlPath),
    json_path: p.json_path || p.key || '',
  }));
}

/**
 * 将解析后的配置转为创建/更新 API 载荷
 * @param {ReturnType<typeof parseApiTemplateImportJson>} imported
 * @param {{ templateCode?: string, name?: string }} [overrides]
 */
export function toApiTemplatePayload(imported, overrides = {}) {
  const httpMethod = imported.http_method || 'POST';
  const urlPath = imported.url_path || '/';
  const inputParamsSchema = normalizeImportedInputParamsSchema(imported, httpMethod, urlPath)
    .filter(p => p.key)
    .map(p => ({
      key: p.key,
      label: p.label || p.key,
      default: p.default,
      bind_to: p.bind_to || inferParamBindTo(httpMethod, p.key, urlPath),
      json_path: p.bind_to === 'body' ? (p.json_path || p.key) : (p.json_path || ''),
    }));

  return {
    template_code: overrides.templateCode || imported.template_code || `api-import-${Date.now()}`,
    name: overrides.name || imported.name || imported.template_code || '导入的接口模板',
    description: imported.description || null,
    project_code: imported.project_code || null,
    http_method: httpMethod,
    url_path: urlPath,
    expect_status: imported.expect_status ?? 202,
    headers_json: imported.headers_json || {},
    query_json: imported.query_json || {},
    body_template: imported.body_template || {},
    inject_schema: (imported.inject_schema || []).filter(f => f?.key),
    input_params_schema: inputParamsSchema,
    preflight_steps: imported.preflight_steps || [],
    export_schema: (imported.export_schema || []).filter(f => f?.key),
    forbidden_patterns: imported.forbidden_patterns || [],
    poll_json: imported.poll_json || {},
  };
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
