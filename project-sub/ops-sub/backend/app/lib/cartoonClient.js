'use strict';

async function cartoonRequest(app, path, options = {}) {
  const base = String(app.config.contentOps.cartoonBaseUrl || '').replace(/\/$/, '');
  const token = app.config.contentOps.internalToken;
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method: options.method || 'GET',
      headers: {
        'content-type': 'application/json',
        'x-ops-token': token,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs || 8000),
    });
  } catch (err) {
    const error = new Error(`连不上漫剧：${err.message}`);
    error.status = 503;
    throw error;
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(json?.message || `漫剧接口 ${res.status}`);
    error.status = res.status || 502;
    throw error;
  }
  return json?.data;
}

function cartoonQuery(path, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([ key, value ]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

module.exports = { cartoonRequest, cartoonQuery };
