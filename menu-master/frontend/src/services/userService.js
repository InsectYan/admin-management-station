import { request } from './api.js';

function unwrap(res) {
  return res.data ?? res;
}

export async function fetchUsers(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([ key, value ]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return unwrap(await request(`/users${qs ? `?${qs}` : ''}`));
}

export async function fetchUser(id) {
  return unwrap(await request(`/users/${id}`));
}

export async function updateUser(id, body) {
  return unwrap(await request(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }));
}

export async function resetUserPassword(id, body = {}) {
  return unwrap(await request(`/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

export async function disableUserMfa(id) {
  return unwrap(await request(`/users/${id}/mfa/disable`, { method: 'POST' }));
}

export async function fetchAuditLogs(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([ key, value ]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return unwrap(await request(`/audit-logs${qs ? `?${qs}` : ''}`));
}

function queryString(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([ key, value ]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchExecutions(query = {}) {
  return unwrap(await request(`/executions${queryString(query)}`));
}

export async function fetchExecutionSkills() {
  return unwrap(await request('/executions/skills'));
}

export async function fetchExecution(id) {
  return unwrap(await request(`/executions/${id}`));
}
