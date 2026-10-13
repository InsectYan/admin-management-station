import axios from 'axios';
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper';
import { getAccessToken, redirectToLogin } from '../lib/amsAuth.js';
import { rewriteLoopbackHost } from '../lib/amsAuth.js';

function normalize(base) { return String(base || '').replace(/\/$/, ''); }

export function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured && /^https?:\/\//.test(configured)) return normalize(rewriteLoopbackHost(configured));
  if (qiankunWindow.__POWERED_BY_QIANKUN__) {
    const origin = import.meta.env.VITE_PRECHECK_API_ORIGIN || 'http://localhost:5204';
    return normalize(rewriteLoopbackHost(`${origin}/api`));
  }
  return normalize(configured || '/api');
}

export function isQiankunEmbedded() {
  return !!qiankunWindow.__POWERED_BY_QIANKUN__;
}

export const api = axios.create({ timeout: 60000 });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    const { code, message, data } = res.data ?? {};
    if (code !== 0 && code !== 200) return Promise.reject(new Error(message || '请求失败'));
    return data;
  },
  (err) => {
    if (err.response?.status === 401) redirectToLogin();
    return Promise.reject(new Error(err.response?.data?.message || err.message || '网络请求失败'));
  },
);

export function request(path, options = {}) {
  return api({ url: `${resolveApiBase()}${path}`, ...options });
}
