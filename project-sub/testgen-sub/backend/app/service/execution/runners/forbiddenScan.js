'use strict';

/** @param {unknown} body @param {string[]} patterns */
function scanForbidden(body, patterns) {
  if (!patterns?.length) return null;
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  for (const raw of patterns) {
    const p = String(raw || '').trim();
    if (!p) continue;
    if (p.startsWith('regex:')) {
      try {
        if (new RegExp(p.slice(6), 'i').test(text)) return p;
      } catch {
        /* ignore invalid regex */
      }
    } else if (text.toLowerCase().includes(p.toLowerCase())) {
      return p;
    }
  }
  return null;
}

/** @param {number} statusCode @param {number[]} blockStatuses */
function isBlockedStatus(statusCode, blockStatuses) {
  const codes = blockStatuses?.length ? blockStatuses : [ 400, 401, 403, 404, 405, 422, 429, 500, 502, 503 ];
  return codes.includes(Number(statusCode));
}

module.exports = { scanForbidden, isBlockedStatus };
