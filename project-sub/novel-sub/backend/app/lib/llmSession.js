'use strict';

function parseMaxTokens(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.round(n), 131072);
}

function pickLlmSession(body = {}) {
  const llm_profile = String(body.llm_profile || '').trim() || undefined;
  const max_tokens = parseMaxTokens(body.max_tokens);
  const extra = {};
  if (llm_profile) extra.llm_profile = llm_profile;
  if (max_tokens) extra.max_tokens = max_tokens;
  return extra;
}

module.exports = {
  parseMaxTokens,
  pickLlmSession,
};
