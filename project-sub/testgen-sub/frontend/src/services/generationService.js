import { api, resolveApiBase } from './apiConfig.js';

const base = () => resolveApiBase();

export async function startGeneration({ document_id, module, test_types, options }) {
  const { data } = await api.post(`${base()}/generation-jobs`, {
    document_id,
    module,
    test_types,
    options,
  });
  return data.data;
}

export async function getJob(jobId) {
  const { data } = await api.get(`${base()}/generation-jobs/${jobId}`);
  return data.data;
}

export async function listJobTestCases(jobId, params = {}) {
  const { data } = await api.get(`${base()}/generation-jobs/${jobId}/test-cases`, { params });
  return data.data;
}

export async function pauseJob(jobId) {
  const { data } = await api.post(`${base()}/generation-jobs/${jobId}/pause`);
  return data.data;
}

export async function cancelJob(jobId) {
  const { data } = await api.post(`${base()}/generation-jobs/${jobId}/cancel`);
  return data.data;
}

export async function retryJob(jobId) {
  const { data } = await api.post(`${base()}/generation-jobs/${jobId}/retry`);
  return data.data;
}
