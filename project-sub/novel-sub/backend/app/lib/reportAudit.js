'use strict';

async function reportAudit(ctx, entry) {
  const base = String(ctx.app.config.ops?.baseUrl || 'http://127.0.0.1:5203').replace(/\/$/, '');
  const token = ctx.app.config.ops?.internalToken || process.env.OPS_INTERNAL_TOKEN || 'ops-internal-dev';
  const actor = ctx.state.user?.username || 'local';
  try {
    const res = await fetch(`${base}/api/internal/audit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ops-Token': token,
      },
      body: JSON.stringify({ ...entry, actor }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) ctx.logger.warn('[audit] %s %s', entry.action, res.status);
  } catch (err) {
    ctx.logger.warn('[audit] %s %s', entry.action, err.message);
  }
}

module.exports = { reportAudit };
