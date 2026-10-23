'use strict';

async function complianceCheck(ctx, text, extra = {}) {
  const configured = String(ctx.app.config.ops?.baseUrl || 'http://127.0.0.1:5203').replace(/\/$/, '');
  const bases = [ configured ];
  if (/127\.0\.0\.1|localhost/.test(configured)) bases.push(configured.replace(/127\.0\.0\.1|localhost/, 'host.docker.internal'));
  const token = ctx.app.config.ops?.internalToken || process.env.OPS_INTERNAL_TOKEN || 'ops-internal-dev';
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/internal/compliance/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ops-Token': token,
        },
        body: JSON.stringify({ text, ...extra }),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) {
        ctx.logger.warn('[compliance] %s', res.status);
        continue;
      }
      const json = await res.json();
      return json.data || { version: 0, hits: [], ai_mark: false };
    } catch (err) {
      ctx.logger.warn('[compliance] %s', err.message);
    }
  }
  return null;
}

module.exports = { complianceCheck };
