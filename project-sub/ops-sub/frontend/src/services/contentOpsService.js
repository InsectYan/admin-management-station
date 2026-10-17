import { api, resolveApiBase } from './apiConfig.js';

async function request(path, options = {}) {
  const res = await api({ url: `${resolveApiBase()}${path}`, ...options });
  return res.data?.data;
}

export function fetchContentOverview(params = {}) {
  return request('/content/overview', { method: 'get', params });
}

export function fetchContentProjects(params = {}) {
  return request('/content/projects', { method: 'get', params });
}

export function fetchContentJobs(params = {}) {
  return request('/content/jobs', { method: 'get', params });
}

export function fetchContentJob(bizApp, id) {
  return request(`/content/jobs/${bizApp}/${id}`, { method: 'get' });
}

export function retryContentJob(bizApp, id) {
  return request(`/content/jobs/${bizApp}/${id}/retry`, { method: 'post', timeout: 90000 });
}

export function cancelContentJob(bizApp, id) {
  return request(`/content/jobs/${bizApp}/${id}/cancel`, { method: 'post' });
}

export function fetchContentDeps() {
  return request('/content/deps', { method: 'get' });
}

export function runContentWatch() {
  return request('/content/watch/tick', { method: 'post' });
}

export function fetchContentAlerts(params = {}) {
  return request('/content/alerts', { method: 'get', params });
}

export function ackContentAlert(id) {
  return request(`/content/alerts/${id}/ack`, { method: 'post' });
}

export function resolveContentAlert(id) {
  return request(`/content/alerts/${id}/resolve`, { method: 'post' });
}

export function fetchContentAudit(params = {}) {
  return request('/content/audit', { method: 'get', params });
}

export function fetchContentSettings() {
  return request('/content/settings', { method: 'get' });
}

export function updateContentSettings(body) {
  return request('/content/settings', { method: 'put', data: body });
}
