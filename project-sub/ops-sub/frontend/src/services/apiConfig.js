import axios from 'axios';
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper';
import { getAccessToken, redirectToLogin } from '../lib/amsAuth.js';
import { rewriteLoopbackHost } from '../lib/publicHost.js';

function normalizeBase(base) {
  return String(base || '').replace(/\/$/, '');
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//.test(value) || value.startsWith('//');
}

export function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured && isAbsoluteUrl(configured)) {
    return normalizeBase(rewriteLoopbackHost(configured));
  }
  if (qiankunWindow.__POWERED_BY_QIANKUN__) {
    const origin = import.meta.env.VITE_OPS_API_ORIGIN || 'http://localhost:5203';
    return normalizeBase(rewriteLoopbackHost(`${origin}/api`));
  }
  return normalizeBase(configured || '/api');
}

export function isQiankunEmbedded() {
  return !!qiankunWindow.__POWERED_BY_QIANKUN__;
}

export const api = axios.create({ timeout: 60000 });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    const { code, message, data } = res.data ?? {};
    if (code !== 0 && code !== 200) {
      return Promise.reject(new Error(message || '请求失败'));
    }
    return { ...res, data: { ...res.data, data } };
  },
  (err) => {
    if (err.response?.status === 401) {
      redirectToLogin();
      return Promise.reject(new Error(err.response.data?.message || '未登录'));
    }
    if (err.response?.data?.message) {
      return Promise.reject(new Error(err.response.data.message));
    }
    if (err.code === 'ECONNABORTED') {
      return Promise.reject(new Error('请求超时，请检查网络后重试'));
    }
    if (!err.response) {
      return Promise.reject(new Error('无法连接服务器，请确认 ops-sub 后端已启动'));
    }
    return Promise.reject(new Error(err.message || '网络请求失败'));
  },
);
