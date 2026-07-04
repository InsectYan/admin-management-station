import { api, resolveApiBase } from './apiConfig.js';
import { getLlmProfileId } from '../utils/llmProfileSession.js';

const base = () => resolveApiBase();

function withLlmProfile(body) {
  const llm_profile = getLlmProfileId();
  return llm_profile ? { ...body, llm_profile } : body;
}

export async function startApiTemplateGeneration(payload) {
  const { data } = await api.post(`${base()}/api-template-jobs`, withLlmProfile(payload));
  return data.data;
}

export async function getApiTemplateJob(jobId) {
  const { data } = await api.get(`${base()}/api-template-jobs/${jobId}`);
  return data.data;
}

export async function cancelApiTemplateJob(jobId) {
  const { data } = await api.post(`${base()}/api-template-jobs/${jobId}/cancel`);
  return data.data;
}

export async function retryApiTemplateJob(jobId) {
  const { data } = await api.post(`${base()}/api-template-jobs/${jobId}/retry`, withLlmProfile({}));
  return data.data;
}

export async function confirmImportApiTemplates(jobId, payload = {}) {
  const { data } = await api.post(`${base()}/api-template-jobs/${jobId}/confirm-import`, payload);
  return data.data;
}
