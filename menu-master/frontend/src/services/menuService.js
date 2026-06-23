import { request } from './api.js';

let menusCache = null;
let rootMenusCache = null;

export async function fetchMenus(force = false) {
  if (menusCache && !force) return menusCache;
  const res = await request('/menus');
  menusCache = res.data || [];
  return menusCache;
}

export async function fetchRootMenus(force = false) {
  if (rootMenusCache && !force) return rootMenusCache;
  const res = await request('/menus/root');
  rootMenusCache = res.data || [];
  return rootMenusCache;
}

export function clearMenuCache() {
  menusCache = null;
  rootMenusCache = null;
}

export async function createMenu(payload, token) {
  const res = await request('/menus', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  clearMenuCache();
  return res.data;
}

export async function updateMenu(id, payload, token) {
  const res = await request(`/menus/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  clearMenuCache();
  return res.data;
}

export async function deleteMenu(id, token) {
  await request(`/menus/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  clearMenuCache();
}
