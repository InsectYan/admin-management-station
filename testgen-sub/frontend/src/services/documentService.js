import { api, resolveApiBase } from './apiConfig.js';

const base = () => resolveApiBase();

export async function listDocuments(params = {}) {
  const { data } = await api.get(`${base()}/documents`, { params });
  return data.data;
}

export async function uploadDocument(file, { title, module, tags } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  if (module) form.append('module', module);
  if (tags) form.append('tags', JSON.stringify(tags));
  const { data } = await api.post(`${base()}/documents/upload`, form);
  return data.data;
}

export async function createDocument(body) {
  const { data } = await api.post(`${base()}/documents`, body);
  return data.data;
}

export async function getDocument(id) {
  const { data } = await api.get(`${base()}/documents/${id}`);
  return data.data;
}

export async function deleteDocument(id) {
  const { data } = await api.delete(`${base()}/documents/${id}`);
  return data.data;
}
