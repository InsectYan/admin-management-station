'use strict';

async function profileEnabled(ctx, profileId) {
  const configured = String(ctx.app.config.ops?.baseUrl || 'http://127.0.0.1:5203').replace(/\/$/, '');
  const bases = [ configured ];
  if (/127\.0\.0\.1|localhost/.test(configured)) bases.push(configured.replace(/127\.0\.0\.1|localhost/, 'host.docker.internal'));
  const token = ctx.app.config.ops?.internalToken || process.env.OPS_INTERNAL_TOKEN || 'ops-internal-dev';
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/internal/models/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ops-Token': token,
        },
        body: JSON.stringify({ profile_id: profileId }),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      const json = await res.json();
      return json.data ? json.data.enabled !== false : null;
    } catch (err) {
      ctx.logger.warn('[model-gate] %s', err.message);
    }
  }
  return null;
}

module.exports = { profileEnabled };
