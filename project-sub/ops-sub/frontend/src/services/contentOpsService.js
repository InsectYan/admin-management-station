import { api, resolveApiBase } from './apiConfig.js';

async function request(path, options = {}) {
  const res = await api({ url: `${resolveApiBase()}${path}`, ...options });
  return res.data?.data;
}

export function fetchContentBoard() {
  return request('/content/board', { method: 'get' });
}

export function fetchChannels() {
  return request('/content/channels', { method: 'get' });
}

export function createChannel(data) {
  return request('/content/channels', { method: 'post', data });
}

export function fetchRecords() {
  return request('/content/records', { method: 'get' });
}

export function scheduleRecord(data) {
  return request('/content/records', { method: 'post', data });
}

export function finishRecord(id, data) {
  return request(`/content/records/${id}/result`, { method: 'post', data });
}

export function takedownRecord(id, data) {
  return request(`/content/records/${id}/takedown`, { method: 'post', data });
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

export function viewAuditPrompt(id) {
  return request(`/content/audit/${id}/prompt`, { method: 'post' });
}

export function fetchLineage(outputId) {
  return request('/content/lineage', { method: 'get', params: { output_id: outputId } });
}

export function fetchContentSettings() {
  return request('/content/settings', { method: 'get' });
}

export function updateContentSettings(body) {
  return request('/content/settings', { method: 'put', data: body });
}

export function fetchModels() {
  return request('/content/models', { method: 'get' });
}

export function updateModel(catalog, id, enabled) {
  return request(`/content/models/${catalog}/${id}`, { method: 'put', data: { enabled } });
}

export function fetchUsage(params = {}) {
  return request('/content/usage', { method: 'get', params });
}

export function fetchCompliance() {
  return request('/content/compliance', { method: 'get' });
}

export function createCompliance(body) {
  return request('/content/compliance', { method: 'post', data: body });
}

export function updateCompliance(id, body) {
  return request(`/content/compliance/${id}`, { method: 'put', data: body });
}
