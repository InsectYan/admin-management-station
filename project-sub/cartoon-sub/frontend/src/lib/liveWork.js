import { reactive } from 'vue';

const buckets = reactive({});
const loops = new Map();

export function liveWork(projectId) {
  const key = String(projectId || '');
  if (!buckets[key]) {
    buckets[key] = {
      scriptId: null,
      scriptFlight: 0,
      outlineId: null,
      outlineFlight: 0,
      promptShotId: '',
      promptFlight: 0,
      autoMode: '',
      autoImportId: '',
      looping: false,
      generateShotIds: [],
    };
  }
  return buckets[key];
}

export function markLoop(projectId, active) {
  loops.set(String(projectId), Boolean(active));
}

export function loopAlive(projectId) {
  return loops.get(String(projectId)) === true;
}

function storageKey(projectId) {
  return `cartoon-auto:${projectId}`;
}

export function rememberAuto(projectId, mode, importId) {
  const state = liveWork(projectId);
  state.autoMode = mode;
  state.autoImportId = String(importId || '');
  sessionStorage.setItem(storageKey(projectId), JSON.stringify({
    mode,
    importId: state.autoImportId,
  }));
}

export function forgetAuto(projectId) {
  const state = liveWork(projectId);
  state.autoMode = '';
  state.autoImportId = '';
  state.looping = false;
  sessionStorage.removeItem(storageKey(projectId));
}

export function storedAuto(projectId) {
  try {
    const raw = sessionStorage.getItem(storageKey(projectId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
