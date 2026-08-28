import { api, resolveApiBase } from './apiConfig.js';

async function request(path, options = {}) {
  const res = await api({
    url: `${resolveApiBase()}${path}`,
    ...options,
  });
  return res.data?.data;
}

export function fetchNovelEnums() {
  return request('/novel-enums');
}
