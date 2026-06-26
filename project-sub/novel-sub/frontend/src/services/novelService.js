import { resolveNovelApiBase } from './apiConfig.js';

const API_BASE = resolveNovelApiBase();

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  if (json && json.code !== 0 && json.code !== 200) {
    throw new Error(json.message || '请求失败');
  }
  return json?.data;
}

export function fetchNovels(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/novels${qs ? `?${qs}` : ''}`);
}

export function fetchNovel(id) {
  return request(`/novels/${id}`);
}

export function createNovel(payload) {
  return request('/novels', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateNovel(id, payload) {
  return request(`/novels/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteNovel(id) {
  return request(`/novels/${id}`, { method: 'DELETE' });
}
