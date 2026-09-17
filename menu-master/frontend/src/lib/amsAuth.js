export const TOKEN_KEY = 'ams_access_token';
export const USER_KEY = 'ams_user';

export function getAccessToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
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

export function setSession({ token, user }) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAdmin(user = getCachedUser()) {
  return user?.role === 'admin';
}

export function loginPath(redirect) {
  const query = redirect && redirect !== '/login'
    ? `?redirect=${encodeURIComponent(redirect)}`
    : '';
  return `/login${query}`;
}
