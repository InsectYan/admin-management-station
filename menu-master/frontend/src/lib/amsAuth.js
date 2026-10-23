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
  const drop = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith('ams_app_roles:')) drop.push(key);
  }
  drop.forEach(key => localStorage.removeItem(key));
}

export function isSuperAdmin(user = getCachedUser()) {
  return user?.account_type === 'super_admin' || user?.role === 'admin';
}

export function isAdmin(user) {
  return isSuperAdmin(user);
}

export function loginPath(redirect) {
  const query = redirect && redirect !== '/login'
    ? `?redirect=${encodeURIComponent(redirect)}`
    : '';
  return `/login${query}`;
}
