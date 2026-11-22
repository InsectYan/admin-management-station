'use strict';

const MAX_TOKENS_CEILING = 131072;

function parseMaxTokens(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n), MAX_TOKENS_CEILING);
}

module.exports = () => {
  return async function llmSession(ctx, next) {
    const profile = String(ctx.get('x-llm-profile') || '').trim().slice(0, 80);
    const maxTokens = parseMaxTokens(ctx.get('x-llm-max-tokens'));
    const session = {};
    if (profile) session.llm_profile = profile;
    if (maxTokens) session.max_tokens = maxTokens;
    ctx.state.llmSession = session;
    await next();
  };
};
