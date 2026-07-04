import { api } from './apiConfig.js';

export async function fetchObservabilityHealth() {
  const { data } = await api.get('/fitness/observability/health');
  return data.data;
}

/**
 * @param {string} traceId
 */
export async function fetchTrace(traceId) {
  const { data } = await api.get(`/fitness/observability/traces/${encodeURIComponent(traceId)}`);
  return data.data;
}

/**
 * @param {string} runId
 */
export async function fetchRunTraces(runId) {
  const { data } = await api.get(`/fitness/runs/${encodeURIComponent(runId)}/traces`);
  return data.data;
}

/**
 * @param {string} runId
 */
export async function fetchRunSteps(runId) {
  const { data } = await api.get(`/fitness/runs/${encodeURIComponent(runId)}/steps`);
  return data.data;
}

/**
 * @param {string} runId
 */
export async function fetchRunAgentAudit(runId) {
  const { data } = await api.get(`/fitness/runs/${encodeURIComponent(runId)}/agent-audit`);
  return data.data;
}
