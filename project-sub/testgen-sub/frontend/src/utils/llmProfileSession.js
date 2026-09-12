/** 与主应用 menu-master/frontend/src/composables/useLlmProfile.js 键名一致 */
export const LLM_PROFILE_ID_KEY = 'ams-llm-profile-id';
/** 与主应用 menu-master/frontend/src/composables/useLlmMaxTokens.js 键名一致 */
export const LLM_MAX_TOKENS_KEY = 'ams-llm-max-tokens';

/**
 * 每次调用 Agent 前读取最新 sessionStorage 中的模型 profile。
 * @returns {string|undefined}
 */
export function getLlmProfileId() {
  try {
    const id = sessionStorage.getItem(LLM_PROFILE_ID_KEY);
    return id || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 主应用可选最大 Token；未配置则返回 undefined（走模型/技能默认）。
 * @returns {number|undefined}
 */
export function getLlmMaxTokens() {
  try {
    const n = Number(sessionStorage.getItem(LLM_MAX_TOKENS_KEY));
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.min(Math.round(n), 131072);
  } catch {
    return undefined;
  }
}

/** 把主应用侧栏的模型与 Token 配置附到请求体 */
export function withLlmSession(body = {}) {
  const llm_profile = getLlmProfileId();
  const max_tokens = getLlmMaxTokens();
  return {
    ...body,
    ...(llm_profile ? { llm_profile } : {}),
    ...(max_tokens ? { max_tokens } : {}),
  };
}
