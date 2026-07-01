'use strict';

const METHODS_WITH_BODY = new Set([ 'POST', 'PUT', 'PATCH' ]);

function methodNeedsBody(method) {
  return METHODS_WITH_BODY.has(String(method || 'GET').toUpperCase());
}

function tryParseJsonBody(raw) {
  if (raw == null) return undefined;
  if (typeof raw === 'object') return raw;
  const text = String(raw).trim();
  if (!text) return undefined;
  if (!text.startsWith('{') && !text.startsWith('[')) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * 按 HTTP Method 解析请求体：优先 config.body，其次 test_input_example（须为 JSON 文本）。
 * GET/HEAD/DELETE 等无 body 方法返回 undefined。
 * @param {string} method
 * @param {{ body?: unknown, test_input_example?: unknown }} config
 */
function resolveHttpBody(method, config = {}) {
  if (!methodNeedsBody(method)) return undefined;
  if (config.body != null && config.body !== '') {
    const fromBody = tryParseJsonBody(config.body);
    if (fromBody !== undefined) return fromBody;
  }
  return tryParseJsonBody(config.test_input_example);
}

function normalizeDetConfigJson(configJson = {}) {
  const method = String(
    configJson.http_method || configJson.method || 'GET',
  ).toUpperCase();
  const normalized = { ...configJson };
  if (methodNeedsBody(method)) {
    const body = resolveHttpBody(method, normalized);
    if (body !== undefined) normalized.body = body;
    else delete normalized.body;
  } else {
    delete normalized.body;
  }
  return normalized;
}

module.exports = {
  METHODS_WITH_BODY,
  methodNeedsBody,
  tryParseJsonBody,
  resolveHttpBody,
  normalizeDetConfigJson,
};
