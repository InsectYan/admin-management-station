'use strict';

async function cartoonRequest(app, path, options = {}) {
  const configured = String(app.config.contentOps.cartoonBaseUrl || 'http://127.0.0.1:5205').replace(/\/$/, '');
  const bases = [ configured ];
  if (/127\.0\.0\.1|localhost/.test(configured)) bases.push(configured.replace(/127\.0\.0\.1|localhost/, 'host.docker.internal'));
  const token = app.config.contentOps.internalToken;
  let lastError = null;
  for (const base of bases) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: options.method || 'GET',
        headers: {
          'content-type': 'application/json',
          'x-ops-token': token,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(options.timeoutMs || 8000),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const error = new Error(json?.message || `漫剧接口 ${res.status}`);
        error.status = res.status || 502;
        throw error;
      }
      return json?.data;
    } catch (err) {
      lastError = err;
      if (err.status) throw err;
    }
  }
  const error = new Error(`连不上漫剧：${lastError?.message || '失败'}`);
  error.status = 503;
  throw error;
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
