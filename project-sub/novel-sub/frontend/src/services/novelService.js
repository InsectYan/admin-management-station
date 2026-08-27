import { api, resolveApiBase } from './apiConfig.js';

async function request(path, options = {}) {
  const res = await api({
    url: `${resolveApiBase()}${path}`,
    ...options,
  });
  return res.data?.data;
}

export function fetchNovels(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== '' && val != null) qs.set(key, String(val));
  });
  const q = qs.toString();
  return request(`/novels${q ? `?${q}` : ''}`);
}

export function fetchNovel(id) {
  return request(`/novels/${id}`);
}

export function createNovel(payload) {
  return request('/novels', { method: 'POST', data: payload });
}

export function updateNovel(id, payload) {
  return request(`/novels/${id}`, { method: 'PUT', data: payload });
}

export function deleteNovel(id) {
  return request(`/novels/${id}`, { method: 'DELETE' });
}

export function batchDeleteNovels(ids) {
  return request('/novels/batch-delete', { method: 'POST', data: { ids } });
}

export function fetchNovelSetting(id) {
  return request(`/novels/${id}/setting`);
}

export function updateNovelSetting(id, patch) {
  return request(`/novels/${id}/setting`, { method: 'PUT', data: patch });
}
