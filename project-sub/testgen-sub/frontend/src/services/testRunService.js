import { api, resolveApiBase } from './apiConfig.js';

const base = () => resolveApiBase();

export async function createRun(payload) {
  const { data } = await api.post(`${base()}/test-runs`, payload);
  return data.data;
}

export async function getRun(id) {
  const { data } = await api.get(`${base()}/test-runs/${id}`);
  return data.data;
}

export async function cancelRun(id) {
  const { data } = await api.post(`${base()}/test-runs/${id}/cancel`);
  return data.data;
}

export async function getRunResults(id) {
  const { data } = await api.get(`${base()}/test-runs/${id}/results`);
  return data.data;
}

export async function listRuns(params = {}) {
  const { data } = await api.get(`${base()}/test-runs`, { params });
  return data.data;
}
