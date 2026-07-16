'use strict';

const METHODS_WITH_BODY = new Set([ 'POST', 'PUT', 'PATCH' ]);

function methodNeedsBody(method) {
  return METHODS_WITH_BODY.has(String(method || 'GET').toUpperCase());
}

function isEmptyBodyValue(value) {
  if (value == null || value === '') return true;
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.length === 0;
    return Object.keys(value).length === 0;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    return !t || t === '{}' || t === '[]';
  }
  return false;
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
 * 空对象 {} / 空数组 [] 视为未填写，继续回退到 example。
 * GET/HEAD/DELETE 等无 body 方法返回 undefined。
 * @param {string} method
 * @param {{ body?: unknown, test_input_example?: unknown }} config
 */
function resolveHttpBody(method, config = {}) {
  if (!methodNeedsBody(method)) return undefined;
  if (config.body != null && config.body !== '' && !isEmptyBodyValue(config.body)) {
    const fromBody = tryParseJsonBody(config.body);
    if (fromBody !== undefined && !isEmptyBodyValue(fromBody)) return fromBody;
  }
  const fromExample = tryParseJsonBody(config.test_input_example);
  if (fromExample !== undefined && !isEmptyBodyValue(fromExample)) return fromExample;
  return undefined;
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
  isEmptyBodyValue,
  tryParseJsonBody,
  resolveHttpBody,
  normalizeDetConfigJson,
};
