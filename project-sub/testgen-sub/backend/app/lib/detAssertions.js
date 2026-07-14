'use strict';

const { getByPath } = require('../service/execution/runners/varPool');

/**
 * 从文本提取 code=XXX / key=value / $.path=value 类期望
 * @param {string|string[]} texts
 * @returns {{ type: string, path?: string, expect?: unknown, max?: number }[]}
 */
function parseExpectRulesFromText(...texts) {
  const rules = [];
  const flat = texts
    .flatMap(t => (Array.isArray(t) ? t : [ t ]))
    .filter(Boolean)
    .map(String)
    .join('\n');

  // status / HTTP 429
  const statusMatch = flat.match(/(?:^|[^\d])(1\d{2}|2\d{2}|3\d{2}|4\d{2}|5\d{2})(?:[^\d]|$)/);
  // prefer explicit "期望 429" / "断言：429" / "+ 429"
  const statusExplicit = flat.match(/(?:期望|断言[:：]?|status\s*[=:：]|HTTP\s+)\s*(\d{3})/i)
    || flat.match(/\b(\d{3})\s*\+/);
  const statusCode = statusExplicit
    ? Number(statusExplicit[1])
    : (statusMatch ? Number(statusMatch[1]) : null);
  if (statusCode != null && statusCode >= 100 && statusCode <= 599) {
    rules.push({ type: 'status', expect: statusCode });
  }

  // code=TURN_xxx / code: TURN_xxx / "code"="TURN_xxx"
  const codeRe = /\bcode\s*[=:：]\s*['"]?([A-Z][A-Z0-9_]+)['"]?/gi;
  let m;
  while ((m = codeRe.exec(flat))) {
    rules.push({ type: 'json_path', path: '$.code', expect: m[1] });
  }

  // snake_case / camelCase 字段期望：error=xxx、retry_after_sec=3
  const kvRe = /\b([a-z][\w.]*)\s*[=:：]\s*['"]?([^'"\s,+，；;]+)['"]?/gi;
  while ((m = kvRe.exec(flat))) {
    const key = m[1];
    const val = m[2];
    if (/^(code|status|http|expect|expect_status|type)$/i.test(key)) continue;
    if (!/^[a-z][\w.]*$/i.test(key)) continue;
    if (!key.includes('_') && !/^(error|message|status|ok)$/i.test(key)) continue;
    const path = key.startsWith('$') ? key : `$.${key}`;
    rules.push({ type: 'json_path', path, expect: coerceExpect(val) });
  }

  if (/\bretry_after_sec\b/i.test(flat) && !rules.some(r => r.path === '$.retry_after_sec')) {
    rules.push({ type: 'json_path', path: '$.retry_after_sec', exists: true });
  }

  return dedupeRules(rules);
}

function coerceExpect(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function dedupeRules(rules) {
  const seen = new Set();
  const out = [];
  for (const r of rules) {
    const key = `${r.type}|${r.path}|${r.expect}|${r.exists}|${r.max}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * 组装 DET 主请求断言：status + config.assertions + 文案推导
 * @param {object} configJson
 * @param {object} [item]
 */
function buildDetAssertions(configJson = {}, item = {}) {
  const statusExpected = configJson.http_status_expected
    ?? item.http_status_expected
    ?? 200;
  const manual = Array.isArray(configJson.assertions) ? [ ...configJson.assertions ] : [];
  const hasStatus = manual.some(a => a && a.type === 'status');
  const assertions = [];
  if (!hasStatus) {
    assertions.push({ type: 'status', expect: Number(statusExpected) });
  }
  assertions.push(...manual);

  const derived = parseExpectRulesFromText(
    item.expected_observation,
    item.assertion_points,
    configJson.assertion_text,
  );
  for (const rule of derived) {
    const dup = assertions.some(a =>
      a.type === rule.type
      && (a.path || '') === (rule.path || '')
      && String(a.expect) === String(rule.expect)
      && Boolean(a.exists) === Boolean(rule.exists),
    );
    if (!dup) assertions.push(rule);
  }

  return assertions;
}

/**
 * @param {object} body
 * @param {object} rule
 */
function evalJsonPathRule(body, rule) {
  const path = rule.path || rule.json_path || '';
  const actual = getByPath(body, path) ?? getByPath(body, path.replace(/^\$\./, ''));
  if (rule.exists) {
    const ok = actual !== undefined && actual !== null && actual !== '';
    return {
      ok,
      message: ok ? `${path} 存在` : `期望存在 ${path}，实际缺失`,
      actual,
    };
  }
  const expect = rule.expect;
  const ok = String(actual) === String(expect);
  return {
    ok,
    message: ok ? `${path} 匹配` : `期望 ${path}=${expect}，实际 ${actual}`,
    actual,
  };
}

module.exports = {
  parseExpectRulesFromText,
  buildDetAssertions,
  evalJsonPathRule,
  coerceExpect,
};
