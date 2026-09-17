import { getAccessToken, clearSession, loginPath } from '../lib/amsAuth.js';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const body = await res.json().catch(() => null);

  if (res.status === 401) {
    clearSession();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign(loginPath(window.location.pathname + window.location.search));
    }
    const message = body?.message || '未登录';
    throw new Error(message);
  }

  if (!res.ok) {
    const message = body?.message || res.statusText || '请求失败';
    throw new Error(message);
  }

  return body;
}

export { API_BASE, request };
