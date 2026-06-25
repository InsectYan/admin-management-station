import { api, resolveApiBase } from './apiConfig.js';

const base = () => resolveApiBase();

export async function listModules() {
  const { data } = await api.get(`${base()}/modules`);
  return data.data;
}

export async function searchKnowledge(params = {}) {
  const { data } = await api.get(`${base()}/knowledge`, { params });
  return data.data;
}
