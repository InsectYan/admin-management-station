import { request } from './api.js';

export async function fetchLlmProfiles() {
  const body = await request('/llm/profiles');
  return body.data ?? body;
}
