import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

function normalizeBase(base) {
  return String(base || '').replace(/\/$/, '');
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//.test(value) || value.startsWith('//');
}

/**
 * Qiankun 嵌入主应用时，相对路径 /api 会打到主应用 BFF（7001）并触发 JWT 401。
 * 子应用业务 API 须指向 novel BFF（7002）。
 */
export function resolveNovelApiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured && isAbsoluteUrl(configured)) {
    return normalizeBase(configured);
  }
  if (qiankunWindow.__POWERED_BY_QIANKUN__) {
    return normalizeBase(import.meta.env.VITE_NOVEL_API_ORIGIN
      ? `${import.meta.env.VITE_NOVEL_API_ORIGIN}/api`
      : 'http://localhost:7002/api');
  }
  return normalizeBase(configured || '/api');
}

export function isQiankunEmbedded() {
  return !!qiankunWindow.__POWERED_BY_QIANKUN__;
}
