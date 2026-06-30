import { api, resolveApiBase } from './apiConfig.js';

api.defaults.baseURL = resolveApiBase();

export async function fetchProjects(params) {
  const { data } = await api.get('/projects', { params });
  return data.data;
}

export async function fetchProject(projectCode) {
  const { data } = await api.get(`/projects/${encodeURIComponent(projectCode)}`);
  return data.data;
}

export async function createProject(payload) {
  const { data } = await api.post('/projects', payload);
  return data.data;
}

export async function updateProject(projectCode, payload) {
  const { data } = await api.put(`/projects/${encodeURIComponent(projectCode)}`, payload);
  return data.data;
}

export async function deleteProject(projectCode) {
  await api.delete(`/projects/${encodeURIComponent(projectCode)}`);
}

export async function createProjectEnvironment(projectCode, payload) {
  const { data } = await api.post(`/projects/${encodeURIComponent(projectCode)}/environments`, payload);
  return data.data;
}

export async function updateProjectEnvironment(projectCode, envId, payload) {
  const { data } = await api.put(
    `/projects/${encodeURIComponent(projectCode)}/environments/${envId}`,
    payload,
  );
  return data.data;
}

export async function deleteProjectEnvironment(projectCode, envId) {
  await api.delete(`/projects/${encodeURIComponent(projectCode)}/environments/${envId}`);
}

export async function fetchProjectEnvironments(projectCode) {
  const { data } = await api.get(`/projects/${encodeURIComponent(projectCode)}/environments`);
  return data.data;
}

export async function fetchProjectVariables(projectCode) {
  const { data } = await api.get(`/projects/${encodeURIComponent(projectCode)}/variables`);
  return data.data;
}

export async function fetchProjectHealth(projectCode) {
  const { data } = await api.get(`/projects/${encodeURIComponent(projectCode)}/health`);
  return data.data;
}

export async function syncProjectEnvironments(projectCode, payload) {
  const { data } = await api.post(`/projects/${encodeURIComponent(projectCode)}/environments/sync`, payload);
  return data.data;
}

export async function saveProjectVariables(projectCode, payload) {
  const { data } = await api.put(`/projects/${encodeURIComponent(projectCode)}/variables`, payload);
  return data.data;
}
