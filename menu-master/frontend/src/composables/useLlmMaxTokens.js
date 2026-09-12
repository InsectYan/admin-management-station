/** sessionStorage 键名 — 与子应用 llmProfileSession 保持一致 */
export const LLM_MAX_TOKENS_KEY = 'ams-llm-max-tokens';

/** 常用档位（单位 k，实际值为 k × 1024） */
export const LLM_MAX_TOKEN_OPTIONS_K = [2, 4, 8, 12, 16, 20, 24, 32, 40, 50, 64, 80, 100, 128];

export function tokensFromK(k) {
  return Number(k) * 1024;
}

export function formatTokenLabel(tokens) {
  const n = Number(tokens);
  if (!Number.isFinite(n) || n <= 0) return '';
  const k = n / 1024;
  return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
}

export function parseStoredMaxTokens(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  return Math.min(Math.round(n), 131072);
}

export function readLlmMaxTokens() {
  try {
    return parseStoredMaxTokens(sessionStorage.getItem(LLM_MAX_TOKENS_KEY) || '');
  } catch {
    return '';
  }
}

export function writeLlmMaxTokens(tokens) {
  try {
    const parsed = parseStoredMaxTokens(tokens);
    if (!parsed) {
      sessionStorage.removeItem(LLM_MAX_TOKENS_KEY);
      return;
    }
    sessionStorage.setItem(LLM_MAX_TOKENS_KEY, String(parsed));
  } catch {
    /* ignore quota / private mode */
  }
}
