import { api, resolveApiBase } from './apiConfig.js';

const base = () => resolveApiBase();

export function resolveDocumentFileUrl(filePath) {
  if (!filePath) return '';
  if (/^https?:\/\//.test(filePath)) return filePath;
  const apiBase = resolveApiBase();
  const origin = apiBase.replace(/\/api$/, '');
  const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
  return `${origin}${path}`;
}

export async function listDocuments(params = {}) {
  const { data } = await api.get(`${base()}/documents`, { params });
  return data.data;
}

export async function previewDocument(file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`${base()}/documents/preview`, form);
  const result = data.data;
  if (result?.file_url) {
    result.file_url = resolveDocumentFileUrl(result.file_url);
  }
  return result;
}

export async function getDocumentPreview(id) {
  const { data } = await api.get(`${base()}/documents/${id}/preview`);
  const result = data.data;
  if (result?.file_url) {
    result.file_url = resolveDocumentFileUrl(result.file_url);
  }
  return result;
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
