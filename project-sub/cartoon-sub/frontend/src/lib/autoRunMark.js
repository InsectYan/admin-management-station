import { reactive } from 'vue';

const marks = new Map();
const STORAGE_KEY = 'cartoon-auto-run';

function storedMap() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function bucket(raw) {
  return {
    done: Number(raw?.done) || 0,
    total: Number(raw?.total) || 0,
    active: Number(raw?.active) || 0,
  };
}

export function rememberAutoRun(projectId, mark) {
  const id = String(projectId || '');
  if (!id) return;
  const all = storedMap();
  const prompt = bucket(mark.prompt);
  const video = bucket(mark.video);
  const busy = Boolean(mark.running || mark.promptLive || mark.videoLive || prompt.active || video.active);
  const finished = prompt.done >= prompt.total && video.done >= video.total;
  if (!busy && finished) delete all[id];
  else {
    all[id] = { prompt, video };
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* 浏览器不让写会话存储时，进度仍留在当前页面 */
  }
}

export function autoRunMark(projectId) {
  const id = String(projectId || '');
  let mark = marks.get(id);
  if (!mark) {
    const saved = storedMap()[id] || {};
    mark = reactive({
      running: false,
      prompt: bucket(saved.prompt),
      video: bucket(saved.video),
      promptLive: false,
      videoLive: false,
      records: [],
      controller: null,
      token: 0,
    });
    marks.set(id, mark);
  }
  return mark;
}
