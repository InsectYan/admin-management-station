import { reactive } from 'vue';
import { getAccessToken, rewriteLoopbackHost } from './amsAuth.js';

const APP_CODE = 'cartoon';
const ROLES_KEY = `ams_app_roles:${APP_CODE}`;
const USER_KEY = 'ams_user';

export const accessState = reactive({
  ready: false,
  super: !getAccessToken(),
  catalog: [],
  mine: [],
});

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isSuper(user) {
  if (!user) return false;
  if (user.account_type === 'super_admin') return true;
  return user.role === 'admin';
}

function applyCache() {
  const catalog = readJson(ROLES_KEY);
  const user = readJson(USER_KEY);
  if (Array.isArray(catalog)) accessState.catalog = catalog;
  if (user) {
    accessState.mine = Array.isArray(user.roles)
      ? user.roles.filter(item => item.app_code === APP_CODE)
      : [];
    accessState.super = isSuper(user);
  }
}

export function canMake() {
  if (!getAccessToken() || accessState.super) return true;
  const catalog = new Set(accessState.catalog.filter(item => item.status !== 'disabled').map(item => item.code));
  return accessState.mine.some(item => item.code === 'maker' && catalog.has('maker'));
}

async function mainGet(path) {
  const base = rewriteLoopbackHost(import.meta.env.VITE_MAIN_API_ORIGIN || 'http://localhost:5200');
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function refreshAccess() {
  if (!getAccessToken()) {
    accessState.super = true;
    accessState.ready = true;
    return;
  }
  applyCache();
  accessState.ready = true;
  const [meResult, rolesResult] = await Promise.allSettled([
    mainGet('/api/auth/me'),
    mainGet(`/api/open/roles?app_code=${APP_CODE}`),
  ]);
  if (meResult.status === 'fulfilled') {
    const user = meResult.value?.data?.user;
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      accessState.mine = (user.roles || []).filter(item => item.app_code === APP_CODE);
      accessState.super = isSuper(user);
    }
  }
  if (rolesResult.status === 'fulfilled') {
    const list = rolesResult.value?.data?.list || [];
    localStorage.setItem(ROLES_KEY, JSON.stringify(list));
    accessState.catalog = list;
  }
}
