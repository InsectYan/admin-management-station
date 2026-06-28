import axios from 'axios';
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

function normalizeBase(base) {
  return String(base || '').replace(/\/$/, '');
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//.test(value) || value.startsWith('//');
}

/**
 * Qiankun 嵌入主应用时，相对路径 /api 会打到主应用 BFF（5200）并触发 JWT 401。
 * 子应用业务 API 须指向 testgen BFF（5202）。
 */
export function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured && isAbsoluteUrl(configured)) {
    return normalizeBase(configured);
  }
  if (qiankunWindow.__POWERED_BY_QIANKUN__) {
    return normalizeBase(
      import.meta.env.VITE_TESTGEN_API_ORIGIN
        ? `${import.meta.env.VITE_TESTGEN_API_ORIGIN}/api`
        : 'http://localhost:5202/api',
    );
  }
  return normalizeBase(configured || '/api');
}

export function isQiankunEmbedded() {
  return !!qiankunWindow.__POWERED_BY_QIANKUN__;
}

export const api = axios.create({ timeout: 60000 });

api.interceptors.response.use(
  (res) => {
    const { code, message, data } = res.data ?? {};
    if (code !== 0 && code !== 200) {
      return Promise.reject(new Error(message || '请求失败'));
    }
    return { ...res, data: { ...res.data, data } };
  },
  (err) => Promise.reject(err),
);
