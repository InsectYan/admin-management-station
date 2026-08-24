'use strict';

const HTTP_VERB = /\b(GET|POST|PUT|PATCH|DELETE)\b/i;
const METHOD_PATH = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[a-zA-Z0-9_\-/{:?=.&]+)/i;
const STANDALONE_PATH = /(\/[a-z][a-zA-Z0-9_\-/{:?=.&}]{2,})/;
const STATUS_CODE = /\b(?:HTTP\s+)?(\d{3})\b/;

function textBlob(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(v => String(v)).join('\n');
  return String(value);
}

function normalizePath(path) {
  if (!path) return null;
  return String(path)
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '')
    .trim() || null;
}

/** @param {string} text */
function extractFromText(text) {
  const joined = textBlob(text);
  if (!joined) return {};

  const opMatch = joined.match(METHOD_PATH);
  if (opMatch) {
    return {
      http_method: opMatch[1].toUpperCase(),
      endpoint_path: normalizePath(opMatch[2]),
    };
  }

  const pathMatch = joined.match(STANDALONE_PATH);
  if (pathMatch) {
    const methodMatch = joined.match(HTTP_VERB);
    return {
      endpoint_path: normalizePath(pathMatch[1]),
      http_method: methodMatch ? methodMatch[1].toUpperCase() : undefined,
    };
  }

  return {};
}

function pickConfigFields(configJson) {
  if (!configJson || typeof configJson !== 'object') return {};
  return {
    endpoint_path: configJson.endpoint_path || configJson.path || null,
    http_method: configJson.http_method || configJson.method || null,
    http_status_expected: configJson.http_status_expected ?? configJson.expect_status ?? null,
  };
}

/**
 * 从 test_steps / 摘要 / config_json 等推断 HTTP 执行字段（仅补全缺失项）
 * @param {Record<string, unknown>} tc
 */
function inferHttpFields(tc = {}) {
  const out = { ...tc };
  const configFields = pickConfigFields(out.config_json);

  const candidates = [
    configFields,
    extractFromText(out.test_steps),
    extractFromText(out.detail_summary),
    extractFromText(out.expected_observation),
    extractFromText(out.item_name),
    extractFromText(out.test_input_example),
    Array.isArray(out.assertion_points) ? extractFromText(out.assertion_points) : {},
  ];

  for (const src of candidates) {
    if (!out.endpoint_path && src.endpoint_path) out.endpoint_path = src.endpoint_path;
    if (!out.http_method && src.http_method) out.http_method = src.http_method;
    if (out.http_status_expected == null && src.http_status_expected != null) {
      out.http_status_expected = src.http_status_expected;
    }
  }

  if (out.http_status_expected == null) {
    const statusText = [
      out.expected_observation,
      ...(Array.isArray(out.assertion_points) ? out.assertion_points : []),
    ].join(' ');
    const statusMatch = String(statusText).match(STATUS_CODE);
    if (statusMatch) out.http_status_expected = Number(statusMatch[1]);
  }

  return out;
}

/**
 * 解析 TS-01-DET 可用的 HTTP 路径与方法（item + runConfig.config_json）
 * @param {object} item
 * @param {object} [configJson]
 */
function resolveDetHttpTarget(item = {}, configJson = {}) {
  const path = normalizePath(
    item.endpoint_path || configJson.endpoint_path || configJson.path,
  );
  const method = (
    item.http_method || configJson.http_method || configJson.method || 'GET'
  ).toUpperCase();
  // 配置面板（config_json）优先于用例表字段，避免「面板已改 Status 但 item 列仍是旧码」
  const statusExpected = configJson.http_status_expected
    ?? configJson.expect_status
    ?? item.http_status_expected
    ?? null;
  return { path, method, statusExpected };
}

module.exports = {
  inferHttpFields,
  resolveDetHttpTarget,
  extractFromText,
};
