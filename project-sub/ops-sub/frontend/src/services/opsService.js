import { api, resolveApiBase } from './apiConfig.js';

async function request(path, options = {}) {
  const res = await api({ url: `${resolveApiBase()}${path}`, ...options });
  return res.data?.data;
}

export function fetchProjects(params = {}) {
  return request('/projects', { method: 'get', params });
}

export function fetchProject(id) {
  return request(`/projects/${id}`, { method: 'get' });
}

export function createProject(body) {
  return request('/projects', { method: 'post', data: body });
}

export function updateProject(id, body) {
  return request(`/projects/${id}`, { method: 'put', data: body });
}

export function deleteProject(id) {
  return request(`/projects/${id}`, { method: 'delete' });
}

export function fetchProjectTemplate() {
  return request('/projects/template', { method: 'get' });
}

export function importProject(body) {
  return request('/projects/import', { method: 'post', data: body });
}

export function exportProject(id) {
  return request(`/projects/${id}/export`, { method: 'get' });
}

export function generateProjectConfig(body) {
  return request('/projects/generate', { method: 'post', data: body, timeout: 600000 });
}

export function generateAndApplyProject(id, body) {
  return request(`/projects/${id}/generate`, { method: 'post', data: body, timeout: 600000 });
}
