import axios from 'axios';
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper';
import { getAccessToken, redirectToLogin } from '../lib/amsAuth.js';
import { rewriteLoopbackHost } from '../lib/amsAuth.js';

function normalize(base) { return String(base || '').replace(/\/$/, ''); }

export function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured && /^https?:\/\//.test(configured)) return normalize(rewriteLoopbackHost(configured));
  if (qiankunWindow.__POWERED_BY_QIANKUN__) {
    const origin = import.meta.env.VITE_CARTOON_API_ORIGIN || 'http://localhost:5205';
    return normalize(rewriteLoopbackHost(`${origin}/api`));
  }
  return normalize(configured || '/api');
}

export function isQiankunEmbedded() {
  return !!qiankunWindow.__POWERED_BY_QIANKUN__;
}

export const api = axios.create({ timeout: 60000 });

function toApiError(payload = {}, fallbackMessage = '请求失败') {
  const message = String(payload.message || fallbackMessage || '请求失败');
  const errorCode = String(payload.error_code || payload.errorCode || '');
  const detail = payload.detail ? String(payload.detail) : '';
  let text = message;
  if (errorCode && !text.includes(errorCode)) text += ` [${errorCode}]`;
  if (detail && !text.includes(detail)) text += `（${detail}）`;
  const error = new Error(text);
  error.code = payload.code ?? null;
  error.errorCode = errorCode;
  error.detail = detail;
  error.skill = payload.skill || '';
  error.action = payload.action || '';
  error.data = payload.data ?? null;
  return error;
}

const LOCAL_AI_TIMEOUT_MS = 16 * 60 * 1000;
const LOCAL_AI_PATH = /\/draft\/(script|shot-outline|shot-expand)(?:\/|$)|\/assets\/(suggest|match)(?:\/|$)|\/voice\/suggest(?:\/|$)|\/review-findings\/suggest(?:\/|$)|\/nodes\/[^/]+\/run(?:\/|$)|\/subtitles\/build(?:\/|$)/;

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const url = String(config.url || '');
  if (LOCAL_AI_PATH.test(url) && (Number(config.timeout) || 0) < LOCAL_AI_TIMEOUT_MS) {
    config.timeout = LOCAL_AI_TIMEOUT_MS;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    const body = res.data ?? {};
    if (body.code !== 0 && body.code !== 200) return Promise.reject(toApiError(body));
    return body.data;
  },
  (err) => {
    if (err.response?.status === 401) redirectToLogin();
    const payload = err.response?.data;
    if (payload && typeof payload === 'object') return Promise.reject(toApiError(payload, err.message));
    if (err.code === 'ECONNABORTED') {
      return Promise.reject(toApiError({
        code: 408,
        message: '请求超时，服务还没有返回',
        error_code: 'ECONNABORTED',
        detail: err.message,
      }));
    }
    return Promise.reject(toApiError({
      code: err.response?.status || 0,
      message: err.message || '网络请求失败',
      error_code: err.code || '',
    }));
  },
);

export function request(path, options = {}) {
  return api({ url: `${resolveApiBase()}${path}`, ...options });
}
