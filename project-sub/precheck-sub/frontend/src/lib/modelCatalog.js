import { reactive } from 'vue';
import { request } from '../services/apiConfig.js';

const state = reactive({});
const inflight = new Map();

export function modelFolderState(folder) {
  if (!state[folder]) {
    state[folder] = {
      loading: false,
      loaded: false,
      online: true,
      names: [],
      tree: [],
      error: '',
    };
  }
  return state[folder];
}

export function loadModelFolder(folder, force = false) {
  const entry = modelFolderState(folder);
  if (!folder) return Promise.resolve(entry);
  if (!force && inflight.has(folder)) return inflight.get(folder);
  if (entry.loaded && !force) return Promise.resolve(entry);
  entry.loading = true;
  entry.error = '';
  const task = request(`/models/${encodeURIComponent(folder)}`)
    .then(data => {
      entry.online = Boolean(data?.online);
      entry.names = data?.names || [];
      entry.tree = data?.tree || [];
      entry.error = data?.error || '';
      entry.loaded = true;
      return entry;
    })
    .catch(err => {
      entry.online = false;
      entry.names = [];
      entry.tree = [];
      entry.error = err.message || '无法读取模型列表';
      entry.loaded = true;
      return entry;
    })
    .finally(() => {
      entry.loading = false;
      if (inflight.get(folder) === task) inflight.delete(folder);
    });
  inflight.set(folder, task);
  return task;
}
