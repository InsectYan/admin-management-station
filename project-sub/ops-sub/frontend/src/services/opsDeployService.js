import { api, resolveApiBase } from './apiConfig.js';
import { getAccessToken } from '../lib/amsAuth.js';

async function request(path, options = {}) {
  const res = await api({ url: `${resolveApiBase()}${path}`, ...options });
  return res.data?.data;
}

export function fetchGithubProfile() {
  return request('/profile/github', { method: 'get' });
}

export function saveGithubToken(body) {
  return request('/profile/github-token', { method: 'put', data: body });
}

export function fetchDeployProducts() {
  return request('/deploy/products', { method: 'get' });
}

export function fetchGitTags(projectId, params = {}) {
  return request(`/projects/${projectId}/git-tags`, { method: 'get', params });
}

export function createDeployJob(projectId, body) {
  return request(`/projects/${projectId}/deploy`, { method: 'post', data: body });
}

export function fetchProjectDeployJobs(projectId, params = {}) {
  return request(`/projects/${projectId}/deploy/jobs`, { method: 'get', params });
}

export function fetchDeployJobs(params = {}) {
  return request('/deploy/jobs', { method: 'get', params });
}

export function fetchDeployJobsSummary() {
  return request('/deploy/jobs/summary', { method: 'get' });
}

export function fetchDeployJob(jobId) {
  return request(`/deploy/jobs/${jobId}`);
}

export function fetchDeployLogs(jobId, params = {}) {
  return request(`/deploy/jobs/${jobId}/logs`, { method: 'get', params });
}

export function abortDeployJob(jobId) {
  return request(`/deploy/jobs/${jobId}/abort`, { method: 'post' });
}

export function retryDeployJob(jobId) {
  return request(`/deploy/jobs/${jobId}/retry`, { method: 'post' });
}

export function deployStreamUrl(jobId, after) {
  const token = getAccessToken();
  const query = new URLSearchParams();
  if (token) query.set('access_token', token);
  if (after) query.set('after', String(after));
  return `${resolveApiBase()}/deploy/jobs/${jobId}/stream?${query}`;
}

export async function downloadDeployLogsTxt(jobId) {
  const token = getAccessToken();
  const res = await fetch(`${resolveApiBase()}/deploy/jobs/${jobId}/logs.txt`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || '导出日志失败');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deploy-${jobId}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}
