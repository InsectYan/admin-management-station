/** 与主应用 menu-master 侧栏键名一致 */
export const LLM_PROFILE_ID_KEY = 'ams-llm-profile-id';
export const LLM_MAX_TOKENS_KEY = 'ams-llm-max-tokens';

/** 一条工作流发起后钉住当时的模型和 token，避免中途改左上角影响到后续节点 */
let pinned = null;

export function pinLlmSession(session) {
  const profile = String(session?.llm_profile || '').trim();
  const maxTokens = Number(session?.max_tokens);
  if (!profile && !(Number.isFinite(maxTokens) && maxTokens > 0)) {
    pinned = null;
    return;
  }
  pinned = {
    llm_profile: profile || undefined,
    max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? Math.min(Math.round(maxTokens), 131072) : undefined,
  };
}

export function clearLlmPin() {
  pinned = null;
}

export function getLlmProfileId() {
  if (pinned?.llm_profile) return pinned.llm_profile;
  try {
    const id = sessionStorage.getItem(LLM_PROFILE_ID_KEY);
    return id || undefined;
  } catch {
    return undefined;
  }
}

export function getLlmMaxTokens() {
  if (pinned?.max_tokens) return pinned.max_tokens;
  try {
    const n = Number(sessionStorage.getItem(LLM_MAX_TOKENS_KEY));
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.min(Math.round(n), 131072);
  } catch {
    return undefined;
  }
}
