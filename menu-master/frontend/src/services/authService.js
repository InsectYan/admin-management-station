import { request } from './api.js';

export async function login(body) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data ?? res;
}

export async function register(body) {
  const res = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data ?? res;
}

export async function fetchMe() {
  const res = await request('/auth/me');
  return res.data ?? res;
}

export async function loginMfa(body) {
  const res = await request('/auth/login/mfa', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data ?? res;
}

export async function changePassword(body) {
  const res = await request('/auth/password', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data ?? res;
}

export async function setupMfa() {
  const res = await request('/auth/mfa/setup', { method: 'POST' });
  return res.data ?? res;
}

export async function confirmMfa(body) {
  const res = await request('/auth/mfa/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data ?? res;
}

export async function disableMfa(body) {
  const res = await request('/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data ?? res;
}

export async function saveGithubToken(body) {
  const res = await request('/auth/github-token', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return res.data ?? res;
}

export async function clearGithubToken() {
  const res = await request('/auth/github-token', { method: 'DELETE' });
  return res.data ?? res;
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch {
    /* 前端清会话即可 */
  }
}
