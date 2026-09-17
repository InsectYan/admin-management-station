'use strict';

function menuMasterBase() {
  return String(process.env.MENU_MASTER_URL || 'http://127.0.0.1:5200').replace(/\/$/, '');
}

function internalKey() {
  return process.env.OPS_INTERNAL_KEY || process.env.JWT_SECRET || '';
}

function unwrap(body, fallbackMessage) {
  if (body && body.code === 0 && body.data) return body.data;
  const err = new Error((body && body.message) || fallbackMessage);
  err.status = (body && body.code) || 502;
  throw err;
}

async function menuFetch(pathname, { method = 'GET', headers = {}, body, query } = {}) {
  const url = new URL(pathname, `${menuMasterBase()}/`);
  if (query) {
    Object.entries(query).forEach(([ key, value ]) => {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    });
  }
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', ...headers },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((json && json.message) || `menu-master ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return unwrap(json, 'menu-master 返回异常');
}

function bearerHeaders(ctx) {
  const header = ctx.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '') || String(ctx.query.access_token || '');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchProfileStatus(ctx) {
  try {
    const data = await menuFetch('/api/auth/me', { headers: bearerHeaders(ctx) });
    const user = data.user || data;
    return {
      github_token_configured: !!user.github_token_configured,
      github_login: user.github_login || '',
      username: user.username || '',
    };
  } catch (err) {
    if (err.status === 401) throw err;
    return {
      github_token_configured: false,
      github_login: '',
      username: '',
      message: err.message,
    };
  }
}

async function saveGithubToken(ctx, { token, github_login }) {
  const data = await menuFetch('/api/auth/github-token', {
    method: 'PUT',
    headers: bearerHeaders(ctx),
    body: { token, github_login },
  });
  return data.user || data;
}

async function readGithubToken(ctx) {
  try {
    return await menuFetch('/api/auth/github-token', { headers: bearerHeaders(ctx) });
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function readGithubTokenByUsername(username) {
  const name = String(username || '').trim();
  if (!name) return null;
  try {
    return await menuFetch('/api/internal/github-credential', {
      headers: {
        'Content-Type': 'application/json',
        'X-Ops-Internal-Key': internalKey(),
      },
      query: { username: name },
    });
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

module.exports = {
  fetchProfileStatus,
  saveGithubToken,
  readGithubToken,
  readGithubTokenByUsername,
};
