import { api, resolveApiBase } from './apiConfig.js';

const base = () => resolveApiBase();

export async function listEnvs() {
  const { data } = await api.get(`${base()}/env-configs`);
  return data.data;
}

export async function createEnv(body) {
  const { data } = await api.post(`${base()}/env-configs`, body);
  return data.data;
}
