import { api, resolveApiBase } from './apiConfig.js';

api.defaults.baseURL = resolveApiBase();

export async function fetchDashboard() {
  const { data } = await api.get('/fitness/dashboard');
  return data.data;
}

export async function fetchTestItems(params) {
  const { data } = await api.get('/fitness/items', { params });
  return data.data;
}

export async function deleteTestItem(itemId) {
  const { data } = await api.delete(`/fitness/items/${encodeURIComponent(itemId)}`);
  return data.data;
}

export async function batchDeleteTestItems(itemIds) {
  const { data } = await api.post('/fitness/items/batch-delete', { item_ids: itemIds });
  return data.data;
}

export async function deleteTestItemsByFilter(params) {
  const { data } = await api.delete('/fitness/items', { params });
  return data.data;
}

export async function exportTestItems(params, format = 'json') {
  if (format === 'csv') {
    const res = await api.get('/fitness/items/export', {
      params: { ...params, format: 'csv' },
      responseType: 'blob',
    });
    return res.data;
  }
  const { data } = await api.get('/fitness/items/export', { params: { ...params, format: 'json' } });
  return data.data;
}

export async function fetchTestItem(itemId) {
  const { data } = await api.get(`/fitness/items/${encodeURIComponent(itemId)}`);
  return data.data;
}

export async function createManualTestItem(payload) {
  const { data } = await api.post('/fitness/items/manual', payload);
  return data.data;
}

export async function updateItemSchemes(itemId, payload) {
  const { data } = await api.put(`/fitness/items/${encodeURIComponent(itemId)}/schemes`, payload);
  return data.data;
}

export async function fetchBrowseTree() {
  const { data } = await api.get('/fitness/browse');
  return data.data;
}

export async function fetchSchemes(params) {
  const { data } = await api.get('/fitness/schemes', { params });
  return data.data;
}

export async function fetchView(viewName, params) {
  const { data } = await api.get(`/fitness/views/${viewName}`, { params });
  return data.data;
}

export async function fetchEnums(table, params) {
  const { data } = await api.get(`/fitness/enums/${table}`, { params });
  return data.data;
}

export async function fetchRisks(params) {
  const { data } = await api.get('/fitness/risks', { params });
  return data.data;
}

export async function fetchRiskLinks(params) {
  const { data } = await api.get('/fitness/risk-links', { params });
  return data.data;
}

export async function fetchPlans(params) {
  const { data } = await api.get('/fitness/plans', { params });
  return data.data;
}

export async function fetchPlan(id) {
  const { data } = await api.get(`/fitness/plans/${id}`);
  return data.data;
}

export async function createPlan(payload) {
  const { data } = await api.post('/fitness/plans', payload);
  return data.data;
}

export async function updatePlan(id, payload) {
  const { data } = await api.put(`/fitness/plans/${id}`, payload);
  return data.data;
}

export async function appendPlanItems(planId, itemIds) {
  const { data } = await api.post(`/fitness/plans/${planId}/items`, { item_ids: itemIds });
  return data.data;
}

export async function deletePlan(id) {
  const { data } = await api.delete(`/fitness/plans/${id}`);
  return data.data;
}

export async function savePlanResults(id, results) {
  const { data } = await api.post(`/fitness/plans/${id}/results`, { results });
  return data.data;
}

export async function exportPlanReport(id) {
  const { data } = await api.post(`/fitness/plans/${id}/export-report`);
  return data.data;
}

export async function exportPlanDocument(id, format = 'plan') {
  const { data } = await api.post(`/fitness/plans/${id}/export-document`, { format });
  return data.data;
}

export async function fetchPlanReportStats(id) {
  const { data } = await api.get(`/fitness/plans/${id}/report-stats`);
  return data.data;
}

function downloadTextFile(filename, content) {
  const blob = new Blob([ content ], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPlanMarkdown(planName, content) {
  const safe = (planName || 'plan').replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
  downloadTextFile(`${safe}.md`, content);
}

export function downloadPlanHtml(planName, content) {
  const safe = (planName || 'plan').replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
  downloadTextFile(`${safe}.html`, content);
}

export async function exportK6Script(itemId, schemeId = 'TS-09-LOAD') {
  const { data } = await api.get(
    `/fitness/run-config/${encodeURIComponent(itemId)}/k6-script`,
    { params: { scheme_id: schemeId } },
  );
  return data.data;
}

export function downloadK6Script(filename, script) {
  downloadTextFile(filename || 'load-test.js', script);
}

export async function enrichCsvSamples(payload) {
  const { data } = await api.post('/fitness/samples/enrich-csv', payload);
  return data.data;
}

export async function launchPlan(planId, payload) {
  const { data } = await api.post(`/fitness/plans/${planId}/launch`, payload);
  return data.data;
}

export async function fetchPlanRuns(planId) {
  const { data } = await api.get(`/fitness/plans/${planId}/runs`);
  return data.data;
}

export async function fetchEnvironments(params) {
  const { data } = await api.get('/fitness/environments', { params });
  return data.data;
}

export async function updateEnvironment(id, payload) {
  const { data } = await api.put(`/fitness/environments/${id}`, payload);
  return data.data;
}

export async function fetchSampleSets(params) {
  const { data } = await api.get('/fitness/samples', { params });
  return data.data;
}

export async function fetchSampleSet(setId) {
  const { data } = await api.get(`/fitness/samples/${setId}`);
  return data.data;
}

export async function createSampleSet(payload) {
  const { data } = await api.post('/fitness/samples', payload);
  return data.data;
}

export async function updateSampleSet(setId, payload) {
  const { data } = await api.put(`/fitness/samples/${setId}`, payload);
  return data.data;
}

export async function deleteSampleSet(setId) {
  const { data } = await api.delete(`/fitness/samples/${setId}`);
  return data.data;
}

export async function fetchSampleItems(setId) {
  const { data } = await api.get(`/fitness/samples/${setId}/items`);
  return data.data;
}

export async function createSampleItem(setId, payload) {
  const { data } = await api.post(`/fitness/samples/${setId}/items`, payload);
  return data.data;
}

export async function updateSampleItem(setId, itemId, payload) {
  const { data } = await api.put(`/fitness/samples/${setId}/items/${itemId}`, payload);
  return data.data;
}

export async function deleteSampleItem(setId, itemId) {
  const { data } = await api.delete(`/fitness/samples/${setId}/items/${itemId}`);
  return data.data;
}

export async function fetchRunConfig(itemId, schemeId) {
  const { data } = await api.get(`/fitness/run-config/${encodeURIComponent(itemId)}`, {
    params: { scheme_id: schemeId },
  });
  return data.data;
}

export async function fetchFtRuns(params) {
  const { data } = await api.get('/fitness/runs', { params });
  return data.data;
}

export async function fetchFtRun(runId) {
  const { data } = await api.get(`/fitness/runs/${runId}`);
  return data.data;
}

export async function cancelFtRun(runId) {
  const { data } = await api.post(`/fitness/runs/${runId}/cancel`);
  return data.data;
}

export async function saveRunConfig(itemId, payload) {
  const { data } = await api.post(`/fitness/run-config/${encodeURIComponent(itemId)}`, payload);
  return data.data;
}

export async function launchRun(itemId, payload) {
  const { data } = await api.post(`/fitness/run/${encodeURIComponent(itemId)}/launch`, payload);
  return data.data;
}

export async function dryRunLaunch(itemId, body) {
  const { data } = await api.post(`/fitness/run/${encodeURIComponent(itemId)}/launch`, {
    ...body,
    dry_run: true,
  });
  return data.data;
}

export async function rerunFailedRun(runId) {
  const { data } = await api.post(`/fitness/runs/${runId}/rerun-failed`);
  return data.data;
}

export async function exportRunLog(runId) {
  const { data } = await api.get(`/fitness/runs/${runId}/export-log`);
  return data.data;
}

export async function importSampleItems(setId, items) {
  const { data } = await api.post(`/fitness/samples/${setId}/items/bulk`, { items });
  return data.data;
}

export async function scoreManualRun(runId, body) {
  const { data } = await api.post(`/fitness/runs/${runId}/score`, body);
  return data.data;
}

export async function preReviewRun(runId) {
  const { data } = await api.post(`/fitness/runs/${runId}/pre-review`);
  return data.data;
}

export async function analyzeLoadRun(runId) {
  const { data } = await api.post(`/fitness/runs/${runId}/analyze-load`);
  return data.data;
}

export async function summarizePlanReport(planId) {
  const { data } = await api.post(`/fitness/plans/${planId}/summarize`);
  return data.data;
}

/** @param {number|string} runId @param {(payload: object) => void} onMessage */
export function streamFtRun(runId, onMessage) {
  const url = `${resolveApiBase()}/fitness/runs/${encodeURIComponent(runId)}/stream`;
  const es = new EventSource(url);
  es.onmessage = ev => {
    try {
      onMessage(JSON.parse(ev.data));
    } catch {
      /* ignore */
    }
  };
  return es;
}

export async function healthCheckEnv(payload) {
  const { data } = await api.post('/fitness/environments/health-check', payload);
  return data.data;
}

export async function explainFtRun(runId, payload = {}) {
  const { data } = await api.post(`/fitness/runs/${runId}/explain`, payload);
  return data.data;
}

export async function generateFitnessSamples(payload) {
  const { data } = await api.post('/fitness/samples/generate', payload);
  return data.data;
}

export const SCHEME_CONFIG_ROUTES = {
  'TS-01-DET': 'det',
  'TS-02-BND': 'bnd',
  'TS-03-REP': 'rep',
  'TS-04-SET': 'set',
  'TS-05-CHAIN': 'chain',
  'TS-06-PAIR': 'pair',
  'TS-07-NEG': 'neg',
  'TS-08-OBS': 'obs',
  'TS-09-LOAD': 'load',
  'TS-10-MAN': 'man',
};

export const SCHEME_TYPE_TO_ID = Object.fromEntries(
  Object.entries(SCHEME_CONFIG_ROUTES).map(([ id, type ]) => [ type, id ]),
);

/** E2/E3/E4/E5/E7 已实现的方案 */
export const LAUNCHABLE_SCHEMES = new Set([
  'TS-01-DET',
  'TS-02-BND',
  'TS-03-REP',
  'TS-04-SET',
  'TS-05-CHAIN',
  'TS-06-PAIR',
  'TS-07-NEG',
  'TS-08-OBS',
  'TS-09-LOAD',
  'TS-10-MAN',
]);

export function schemeToConfigPath(schemeId) {
  return SCHEME_CONFIG_ROUTES[schemeId] || 'det';
}

export async function fetchTemplateList() {
  const { data } = await api.get('/fitness/template-config/templates');
  return data.data;
}

export async function fetchTemplatesOverview() {
  const { data } = await api.get('/fitness/template-config/templates/overview');
  return data.data;
}

export async function fetchMajorsTemplateOverview() {
  const { data } = await api.get('/fitness/template-config/majors/overview');
  return data.data;
}

export async function fetchSchemeValidations(schemeId) {
  const { data } = await api.get(`/fitness/template-config/schemes/${encodeURIComponent(schemeId)}/validations`);
  return data.data;
}

export async function updateMajorTemplate(majorId, templateCode) {
  const { data } = await api.put(`/fitness/template-config/major/${encodeURIComponent(majorId)}/template`, {
    template_code: templateCode,
  });
  return data.data;
}

export async function updateMajorValidation(majorId, validationId) {
  const { data } = await api.put(`/fitness/template-config/major/${encodeURIComponent(majorId)}/validation`, {
    validation_id: validationId,
  });
  return data.data;
}

export async function updateTemplateValidation(templateCode, validationId) {
  const { data } = await api.put(
    `/fitness/template-config/templates/${encodeURIComponent(templateCode)}/validation`,
    { validation_id: validationId },
  );
  return data.data;
}

export async function fetchMajorTemplateMapping(majorId) {
  const { data } = await api.get(`/fitness/template-config/major/${encodeURIComponent(majorId)}`);
  return data.data;
}

export async function fetchItemTemplateConfig(itemId, params = {}) {
  const { data } = await api.get(`/fitness/template-config/items/${encodeURIComponent(itemId)}`, { params });
  return data.data;
}

export async function saveItemTemplateConfig(itemId, payload) {
  const { data } = await api.post(`/fitness/template-config/items/${encodeURIComponent(itemId)}`, payload);
  return data.data;
}

export async function setItemConfigTemplate(itemId, payload) {
  const { data } = await api.put(
    `/fitness/template-config/items/${encodeURIComponent(itemId)}/template`,
    payload,
  );
  return data.data;
}

export async function generateItemTemplateConfig(itemId, payload = {}) {
  const { data } = await api.post(
    `/fitness/template-config/items/${encodeURIComponent(itemId)}/generate`,
    payload,
  );
  return data.data;
}

export async function fetchApiTemplates(params) {
  const { data } = await api.get('/fitness/api-templates', { params });
  return data.data;
}

export async function fetchApiTemplate(id) {
  const { data } = await api.get(`/fitness/api-templates/${id}`);
  return data.data;
}

export async function createApiTemplate(payload) {
  const { data } = await api.post('/fitness/api-templates', payload);
  return data.data;
}

export async function updateApiTemplate(id, payload) {
  const { data } = await api.put(`/fitness/api-templates/${id}`, payload);
  return data.data;
}

export async function deleteApiTemplate(id) {
  const { data } = await api.delete(`/fitness/api-templates/${id}`);
  return data.data;
}

export async function fetchApiTemplateLinkedItems(id) {
  const { data } = await api.get(`/fitness/api-templates/${id}/linked-items`);
  return data.data;
}
