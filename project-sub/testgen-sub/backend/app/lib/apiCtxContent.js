'use strict';

const { getByPath } = require('../service/execution/runners/varPool');

const DEFAULT_CONTENT_PATHS = [
  '$.response',
  '$.data.response',
  '$.result_json.response',
  '$.data.message',
  '$.data.content',
  '$.data.text',
  '$.data.reply',
  '$.data.answer',
  '$.message',
  '$.content',
];

/**
 * @param {unknown} body
 * @param {string[]} [paths]
 * @returns {string}
 */
function extractResponseText(body, paths = DEFAULT_CONTENT_PATHS) {
  if (body == null) return '';
  if (typeof body === 'string') return body.trim();

  const list = Array.isArray(paths) && paths.length ? paths : DEFAULT_CONTENT_PATHS;
  for (const path of list) {
    const val = getByPath(body, path);
    if (val == null) continue;
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (typeof val === 'object') {
      const nested = JSON.stringify(val);
      if (nested && nested !== '{}' && nested !== '[]') return nested;
    }
  }

  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

/**
 * @param {import('../service/execution/runOrchestrator').SubRunResult[]} results
 */
function splitApiCtxResults(results) {
  const preflight = (results || []).filter(r => r.phase === 'preflight');
  const content = (results || []).filter(r => r.phase === 'api_case');
  const preflightOk = preflight.length === 0 || preflight.every(r => r.sub_verdict === 'pass');
  return { preflight, content, preflightOk };
}

module.exports = {
  DEFAULT_CONTENT_PATHS,
  extractResponseText,
  splitApiCtxResults,
};
