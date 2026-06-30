import { api, resolveApiBase } from './apiConfig.js';
import { getLlmProfileId } from '../utils/llmProfileSession.js';

const base = () => resolveApiBase();

function withLlmProfile(body) {
  const llm_profile = getLlmProfileId();
  return llm_profile ? { ...body, llm_profile } : body;
}

export async function startGeneration({
  staging_id,
  document_id,
  document_content,
  document_title,
  document_type,
  project_code,
  project_name,
  options,
}) {
  const { data } = await api.post(`${base()}/generation-jobs`, withLlmProfile({
    staging_id,
    document_id,
    document_content,
    document_title,
    document_type,
    project_code,
    project_name,
    options,
  }));
  return data.data;
}

export async function getJob(jobId) {
  const { data } = await api.get(`${base()}/generation-jobs/${jobId}`);
  return data.data;
}

export async function listJobGeneratedItems(jobId, params = {}) {
  const { data } = await api.get(`${base()}/generation-jobs/${jobId}/generated-items`, { params });
  return data.data;
}

/** @deprecated use listJobGeneratedItems */
export async function listJobTestCases(jobId, params = {}) {
  return listJobGeneratedItems(jobId, params);
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
  const { data } = await api.post(`${base()}/generation-jobs/${jobId}/retry`, withLlmProfile({}));
  return data.data;
}
