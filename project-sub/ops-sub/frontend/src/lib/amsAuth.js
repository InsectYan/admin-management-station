import { rewriteLoopbackHost } from './publicHost.js';

export const TOKEN_KEY = 'ams_access_token';
export const USER_KEY = 'ams_user';

function userFromToken(token) {
  try {
    const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function consumeHandedToken() {
  const params = new URLSearchParams(window.location.search);
  const handed = params.get('ams_token');
  if (!handed) return;
  localStorage.setItem(TOKEN_KEY, handed);
  const user = userFromToken(handed);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  params.delete('ams_token');
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', next);
}

export function getAccessToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || import.meta.env.VITE_OPS_DEV_TOKEN || '';
  } catch {
    return import.meta.env.VITE_OPS_DEV_TOKEN || '';
  }
}

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function loginUrl(redirect) {
  const main = rewriteLoopbackHost(import.meta.env.VITE_MAIN_ORIGIN || 'http://localhost:5100');
  const target = redirect || window.location.href;
  if (window.location.port === '5100' || window.location.pathname.startsWith('/media/')) {
    return `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }
  return `${main}/login?redirect=${encodeURIComponent(target)}`;
}

export function redirectToLogin() {
  clearSession();
  window.location.assign(loginUrl());
}
