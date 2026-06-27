/** 与主应用 menu-master/frontend/src/composables/useLlmProfile.js 键名一致 */
export const LLM_PROFILE_ID_KEY = 'ams-llm-profile-id';

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
