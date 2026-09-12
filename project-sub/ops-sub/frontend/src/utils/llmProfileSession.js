export const LLM_PROFILE_ID_KEY = 'ams-llm-profile-id';
export const LLM_MAX_TOKENS_KEY = 'ams-llm-max-tokens';

export function getLlmProfileId() {
  try {
    return sessionStorage.getItem(LLM_PROFILE_ID_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function getLlmMaxTokens() {
  try {
    const n = Number(sessionStorage.getItem(LLM_MAX_TOKENS_KEY));
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.min(Math.round(n), 131072);
  } catch {
    return undefined;
  }
}

export function withLlmSession(body = {}) {
  const llm_profile = getLlmProfileId();
  const max_tokens = getLlmMaxTokens();
  return {
    ...body,
    ...(llm_profile ? { llm_profile } : {}),
    ...(max_tokens ? { max_tokens } : {}),
  };
}
