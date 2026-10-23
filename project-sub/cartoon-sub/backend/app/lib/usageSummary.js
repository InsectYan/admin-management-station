'use strict';

async function usageSummary(ctx, projectId) {
  const configured = String(ctx.app.config.ops?.baseUrl || 'http://127.0.0.1:5203').replace(/\/$/, '');
  const bases = [ configured ];
  if (/127\.0\.0\.1|localhost/.test(configured)) bases.push(configured.replace(/127\.0\.0\.1|localhost/, 'host.docker.internal'));
  const token = ctx.app.config.ops?.internalToken || process.env.OPS_INTERNAL_TOKEN || 'ops-internal-dev';
  const query = `biz_app=video&project_id=${encodeURIComponent(projectId)}`;
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/internal/usage?${query}`, {
        headers: { 'X-Ops-Token': token },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      ctx.logger.warn('[usage] %s', err.message);
    }
  }
  return null;
}

module.exports = { usageSummary };
