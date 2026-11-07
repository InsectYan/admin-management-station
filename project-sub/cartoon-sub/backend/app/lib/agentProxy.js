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

function resolveInvokeTimeout(ctx, timeoutMs) {
  const explicit = Number(timeoutMs);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const configured = Number(ctx.app.config.agentPlatform?.timeoutMs);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return 600000;
}

function linkSignals(signals) {
  const list = signals.filter(Boolean);
  if (!list.length) return undefined;
  if (list.length === 1) return list[0];
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(list);
  const controller = new AbortController();
  for (const signal of list) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

async function invokeSkill(ctx, { skill, action, payload, timeoutMs, signal }) {
  const url = `${platformBase(ctx)}/api/skills/${skill}/invoke`;
  const waitMs = resolveInvokeTimeout(ctx, timeoutMs);
  ctx.logger.info('[cartoon] agent POST %s action=%s timeoutMs=%s', url, action, waitMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
      signal: linkSignals([ AbortSignal.timeout(waitMs), signal ]),
    });
  } catch (err) {
    if (signal?.aborted) {
      const stopped = new Error('已停止');
      stopped.status = 499;
      throw stopped;
    }
    const aborted = err?.name === 'AbortError' || /aborted due to timeout/i.test(String(err?.message || ''));
    const message = aborted
      ? `Agent 调用超时（${Math.round(waitMs / 1000)} 秒仍未返回，技能 ${skill}/${action}）`
      : `Agent 调用失败：${err.message}`;
    const wrapped = new Error(message);
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

function agentBases(ctx) {
  const configured = String(ctx.app.config.agentPlatform?.baseUrl || '').replace(/\/$/, '');
  if (!configured) return [];
  const list = [ configured ];
  if (/127\.0\.0\.1|localhost/.test(configured)) {
    list.push(configured.replace(/127\.0\.0\.1|localhost/, 'host.docker.internal'));
  }
  return list;
}

async function listMediaProfiles(ctx) {
  for (const base of agentBases(ctx)) {
    try {
      const res = await fetch(`${base}/api/media/profiles`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) continue;
      const data = await res.json().catch(() => ({}));
      return Array.isArray(data.profiles) ? data.profiles : [];
    } catch {
      // 换一个地址再读
    }
  }
  return [];
}

module.exports = { invokeSkill, listMediaProfiles };
