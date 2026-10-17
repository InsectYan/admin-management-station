'use strict';

function platformBase(ctx) {
  const base = String(ctx.app.config.agentPlatform?.baseUrl || '').replace(/\/$/, '');
  if (!base) {
    const err = new Error('未配置 AGENT_PLATFORM_URL');
    err.status = 503;
    throw err;
  }
  return base;
}

async function invokeSkill(ctx, { skill, action, payload, timeoutMs }) {
  const url = `${platformBase(ctx)}/api/skills/${skill}/invoke`;
  ctx.logger.info('[cartoon] agent POST %s action=%s', url, action);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(timeoutMs || 180000),
    });
  } catch (err) {
    const wrapped = new Error(`Agent 调用失败：${err.message}`);
    wrapped.status = 503;
    throw wrapped;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const wrapped = new Error(data.error || data.message || `Agent HTTP ${res.status}`);
    wrapped.status = res.status >= 500 ? 502 : res.status;
    throw wrapped;
  }
  if (data.output?.stoppedReason === 'no_llm' || data.output?.stoppedReason === 'llm_error') {
    const wrapped = new Error(data.output.summary || data.reply || 'Agent 没有完成起草');
    wrapped.status = 502;
    throw wrapped;
  }
  return data;
}

module.exports = { invokeSkill };
