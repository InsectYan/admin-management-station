'use strict';

async function novelRequest(app, path, options = {}) {
  const configured = String(app.config.contentOps.novelBaseUrl || 'http://127.0.0.1:5201').replace(/\/$/, '');
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
        const error = new Error(json?.message || `叙事接口 ${res.status}`);
        error.status = res.status || 502;
        throw error;
      }
      return json?.data;
    } catch (err) {
      lastError = err;
      if (err.status) throw err;
    }
  }
  const error = new Error(`连不上叙事：${lastError?.message || '失败'}`);
  error.status = 503;
  throw error;
}

function novelQuery(path, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([ key, value ]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

module.exports = { novelRequest, novelQuery };
