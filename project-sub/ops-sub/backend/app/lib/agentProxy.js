'use strict';

const crypto = require('crypto');

function newTraceId() {
  return crypto.randomUUID ? crypto.randomUUID() : `tr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function platformBase(ctx) {
  const config = ctx.app.config.agentPlatform || {};
  const base = String(config.baseUrl || '').replace(/\/$/, '');
  if (!base) {
    const err = new Error('未配置 AGENT_PLATFORM_URL');
    err.status = 503;
    err.code = 'AGENT_NOT_CONFIGURED';
    throw err;
  }
  return { config, base };
}

async function invokeSkill(ctx, { skill, action, payload, timeoutMs }) {
  const { config, base } = platformBase(ctx);
  const url = `${base}/api/skills/${skill}/invoke`;
  const traceId = payload.trace_id || newTraceId();
  const timeout = timeoutMs || config.timeoutMs || 600000;
  const started = Date.now();

  ctx.logger.info('[agentProxy] POST %s action=%s trace=%s', url, action, traceId);

  let result;
  try {
    result = await ctx.curl(url, {
      method: 'POST',
      contentType: 'json',
      dataType: 'json',
      timeout,
      data: {
        action,
        ...payload,
        trace_id: traceId,
      },
    });
  } catch (err) {
    const wrapped = new Error(`Agent 调用失败：${err.message}`);
    wrapped.status = 503;
    wrapped.code = 'AGENT_UNREACHABLE';
    wrapped.cause = err;
    throw wrapped;
  }

  const elapsed = Date.now() - started;
  ctx.logger.info('[agentProxy] %s HTTP %s %sms', skill, result.status, elapsed);

  if (result.status >= 400) {
    const msg = result.data?.message || result.data?.error || `Agent HTTP ${result.status}`;
    const wrapped = new Error(msg);
    wrapped.status = result.status >= 500 ? 502 : result.status;
    wrapped.code = 'AGENT_INVOKE_FAILED';
    wrapped.data = result.data;
    throw wrapped;
  }

  return {
    status: result.status,
    data: result.data,
    traceId,
    elapsed,
  };
}

module.exports = {
  invokeSkill,
  newTraceId,
};
