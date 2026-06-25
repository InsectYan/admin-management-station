import { api, resolveApiBase } from './apiConfig.js';

const base = () => resolveApiBase();

export async function listTestCases(params = {}) {
  const { data } = await api.get(`${base()}/test-cases`, { params });
  return data.data;
}

export async function getTestCase(id) {
  const { data } = await api.get(`${base()}/test-cases/${id}`);
  return data.data;
}

export async function updateTestCase(id, body) {
  const { data } = await api.put(`${base()}/test-cases/${id}`, body);
  return data.data;
}

export async function deleteTestCase(id) {
  const { data } = await api.delete(`${base()}/test-cases/${id}`);
  return data.data;
}

export async function exportTestCases(params = {}) {
  const { data } = await api.get(`${base()}/test-cases/export`, {
    params,
    responseType: 'blob',
  });
  return data;
}
