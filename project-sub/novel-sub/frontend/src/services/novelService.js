import { api, resolveApiBase } from './apiConfig.js';
import { getMediaProfileId } from '../utils/mediaProfileSession.js';
import { withLlmSession } from '../utils/llmProfileSession.js';

async function request(path, options = {}) {
  const res = await api({
    url: `${resolveApiBase()}${path}`,
    ...options,
  });
  return res.data?.data;
}

export function fetchNovels(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== '' && val != null) qs.set(key, String(val));
  });
  const q = qs.toString();
  return request(`/novels${q ? `?${q}` : ''}`);
}

export function fetchStylePresets() {
  return request('/style-presets');
}

export function saveNovelStyle(id, presetId) {
  return request(`/novels/${id}/style`, { method: 'PUT', data: { preset_id: presetId || '' } });
}

export function fetchNovel(id) {
  return request(`/novels/${id}`);
}

export function createNovel(payload) {
  return request('/novels', { method: 'POST', data: payload });
}

export function fetchStoryTemplates() {
  return request('/story-templates');
}

export function createNovelFromTemplate(payload) {
  return request('/novels/from-template', { method: 'POST', data: payload });
}

export function updateNovel(id, payload) {
  return request(`/novels/${id}`, { method: 'PUT', data: payload });
}

export function deleteNovel(id) {
  return request(`/novels/${id}`, { method: 'DELETE' });
}

export function batchDeleteNovels(ids) {
  return request('/novels/batch-delete', { method: 'POST', data: { ids } });
}

export function fetchNovelSetting(id) {
  return request(`/novels/${id}/setting`);
}

export function updateNovelSetting(id, patch) {
  return request(`/novels/${id}/setting`, { method: 'PUT', data: patch });
}

export function fetchChapterMeta(id) {
  return request(`/novels/${id}/chapters`);
}

export function fetchEmptyChapters(id) {
  return request(`/novels/${id}/chapters/empty`);
}

export function fetchNovelReader(id) {
  return request(`/novels/${id}/reader`);
}

export function fetchChapterBody(id, chapterId) {
  return request(`/novels/${id}/chapters/${encodeURIComponent(chapterId)}`);
}

export function saveChapterBody(id, chapterId, body, extra = {}) {
  return request(`/novels/${id}/chapters/${encodeURIComponent(chapterId)}`, {
    method: 'PUT',
    data: { body, ...extra },
  });
}

export function fetchGenerationRecords(id) {
  return request(`/novels/${id}/generation-records`);
}

export function fetchMembers(id) {
  return request(`/novels/${id}/members`);
}

export function fetchShellMembers(id) {
  return request(`/novels/${id}/shell-members`);
}

export function addMember(id, data) {
  return request(`/novels/${id}/members`, { method: 'POST', data });
}

export function removeMember(id, memberId) {
  return request(`/novels/${id}/members/${memberId}`, { method: 'DELETE' });
}

export function fetchLocks(id) {
  return request(`/novels/${id}/locks`);
}

export function lockChapter(id, chapterId, holder) {
  return request(`/novels/${id}/chapters/${encodeURIComponent(chapterId)}/lock`, {
    method: 'POST',
    data: holder ? { holder } : {},
  });
}

export function unlockChapter(id, chapterId, holder) {
  return request(`/novels/${id}/chapters/${encodeURIComponent(chapterId)}/unlock`, {
    method: 'POST',
    data: holder ? { holder } : {},
  });
}

export function fetchSnapshots(id) {
  return request(`/novels/${id}/snapshots`);
}

export function createSnapshot(id, label) {
  return request(`/novels/${id}/snapshots`, { method: 'POST', data: { label } });
}

export function restoreSnapshot(id, snapshotId) {
  return request(`/novels/${id}/snapshots/${snapshotId}/restore`, { method: 'POST' });
}

export function fetchActivity(id) {
  return request(`/novels/${id}/activity`);
}

export function generateCover(payload = {}) {
  return request('/ai/cover/generate', {
    method: 'POST',
    timeout: 180000,
    data: {
      ...payload,
      media_profile: payload.media_profile || getMediaProfileId(),
    },
  });
}

export function fetchNovelQa(id) {
  return request(`/novels/${id}/qa`);
}

export function runNovelReview(payload = {}) {
  return request('/ai/review', {
    method: 'POST',
    data: withLlmSession(payload),
    timeout: 180000,
  });
}

export function fetchAnomalyReports(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== '' && val != null) qs.set(key, String(val));
  });
  const q = qs.toString();
  return request(`/anomaly-reports${q ? `?${q}` : ''}`);
}

export function fetchAnomalyReport(id) {
  return request(`/anomaly-reports/${id}`);
}

export function createAnomalyReport(novelId, mode) {
  return request('/anomaly-reports', {
    method: 'POST',
    data: { novel_id: novelId, mode },
  });
}

export function runAnomalyTask(reportId, taskId) {
  return request(`/anomaly-reports/${reportId}/tasks/${encodeURIComponent(taskId)}/run`, {
    method: 'POST',
  });
}

export function setAnomalyTaskStatus(reportId, taskId, status, error = '') {
  return request(`/anomaly-reports/${reportId}/tasks/${encodeURIComponent(taskId)}/status`, {
    method: 'POST',
    data: { status, error },
  });
}

export function ignoreNovelQaFinding(id, findingId) {
  return request(`/novels/${id}/qa/ignore`, {
    method: 'POST',
    data: { finding_id: findingId },
  });
}

export function recordStoryExport(id, payload) {
  return request(`/novels/${id}/exports`, { method: 'POST', data: payload });
}

export function fetchStoryDesk(id) {
  return request(`/novels/${id}/packages`);
}

export function fetchPackageDiff(id, from, to) {
  return request(`/novels/${id}/packages/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export function publishStoryPackage(id, chapterIds, scriptIds, intentIds) {
  return request(`/novels/${id}/packages`, {
    method: 'POST',
    data: { chapter_ids: chapterIds, script_ids: scriptIds || [], intent_ids: intentIds || [] },
  });
}

export function fetchStoryPackage(packageId, version) {
  return request(`/packages/${encodeURIComponent(packageId)}?version=${encodeURIComponent(version)}`);
}

export function runConsistency(id, chapterIds) {
  return request(`/novels/${id}/consistency/run`, {
    method: 'POST',
    data: { chapter_ids: chapterIds },
  });
}

export function createTerm(id, payload) {
  return request(`/novels/${id}/terms`, { method: 'POST', data: payload });
}

export function deleteTerm(id, termId) {
  return request(`/novels/${id}/terms/${termId}`, { method: 'DELETE' });
}

export function applyPromotion(id, promotionId) {
  return request(`/novels/${id}/promotions/${promotionId}/apply`, { method: 'POST' });
}

export function rejectPromotion(id, promotionId, reason) {
  return request(`/novels/${id}/promotions/${promotionId}/reject`, {
    method: 'POST',
    data: { reason },
  });
}

export function fetchDialogues(id, chapterId) {
  const query = chapterId ? `?chapter_id=${encodeURIComponent(chapterId)}` : '';
  return request(`/novels/${id}/dialogues${query}`);
}

export function createDialogue(id, data) {
  return request(`/novels/${id}/dialogues`, { method: 'POST', data });
}

export function createDialogueChoice(id, dialogueId, data) {
  return request(`/novels/${id}/dialogues/${dialogueId}/choices`, { method: 'POST', data });
}

export function fetchTimeline(id) {
  return request(`/novels/${id}/timeline`);
}

export function saveTimelineYear(id, data) {
  return request(`/novels/${id}/timeline`, { method: 'PUT', data });
}

export function fetchPlotlines(id) {
  return request(`/novels/${id}/plotlines`);
}

export function createPlotline(id, payload) {
  return request(`/novels/${id}/plotlines`, { method: 'POST', data: payload });
}

export function updatePlotline(id, plotlineId, payload) {
  return request(`/novels/${id}/plotlines/${plotlineId}`, { method: 'PUT', data: payload });
}

export function deletePlotline(id, plotlineId) {
  return request(`/novels/${id}/plotlines/${plotlineId}`, { method: 'DELETE' });
}

export function bindChapterPlotlines(id, chapterId, plotlineIds) {
  return request(`/novels/${id}/chapters/${encodeURIComponent(chapterId)}/plotlines`, {
    method: 'POST',
    data: { plotline_ids: plotlineIds },
  });
}

export function fetchScripts(id) {
  return request(`/novels/${id}/scripts`);
}

export function suggestScript(id, payload) {
  return request(`/novels/${id}/scripts/suggest`, { method: 'POST', data: payload });
}

export function createScript(id, payload) {
  return request(`/novels/${id}/scripts`, { method: 'POST', data: payload });
}

export function updateScript(id, scriptId, payload) {
  return request(`/novels/${id}/scripts/${scriptId}`, { method: 'PUT', data: payload });
}

export function deleteScript(id, scriptId) {
  return request(`/novels/${id}/scripts/${scriptId}`, { method: 'DELETE' });
}

export function fetchIntentShots(id) {
  return request(`/novels/${id}/intent-shots`);
}

export function suggestIntentShots(id, payload) {
  return request(`/novels/${id}/intent-shots/suggest`, { method: 'POST', data: payload });
}

export function createIntentShot(id, payload) {
  return request(`/novels/${id}/intent-shots`, { method: 'POST', data: payload });
}

export function updateIntentShot(id, shotId, payload) {
  return request(`/novels/${id}/intent-shots/${shotId}`, { method: 'PUT', data: payload });
}

export function deleteIntentShot(id, shotId) {
  return request(`/novels/${id}/intent-shots/${shotId}`, { method: 'DELETE' });
}
