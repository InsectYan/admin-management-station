import { request } from './api.js';

export async function fetchMediaProfiles() {
  const body = await request('/media/profiles');
  return body.data ?? body;
}
