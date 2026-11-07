'use strict';

const { Agent } = require('undici');

const FETCH_CAUSE = {
  UND_ERR_HEADERS_TIMEOUT: '等待响应头超时，技能还在生成时连接被断开',
  UND_ERR_BODY_TIMEOUT: '读取响应体超时',
  UND_ERR_CONNECT_TIMEOUT: '连接 Agent 超时',
  ECONNREFUSED: 'Agent 拒绝连接',
  ECONNRESET: 'Agent 连接被重置',
  ENOTFOUND: '找不到 Agent 地址',
  EAI_AGAIN: '解析 Agent 地址失败',
  UND_ERR_SOCKET: '与 Agent 的连接中断',
  EPIPE: '写入 Agent 时连接已关闭',
  ETIMEDOUT: '连接 Agent 超时',
};

function platformBase(ctx) {
  const base = String(ctx.app.config.agentPlatform?.baseUrl || '').replace(/\/$/, '');
  if (!base) {
    const err = new Error('未配置 AGENT_PLATFORM_URL');
    err.status = 503;
    err.errorCode = 'AGENT_UNCONFIGURED';
    throw err;
  }
  return base;
}

function resolveInvokeTimeout(ctx, timeoutMs) {
  const explicit = Number(timeoutMs);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const configured = Number(ctx.app.config.agentPlatform?.timeoutMs);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return 960000;
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

function fetchFailureText(err) {
  const cause = err?.cause;
  const code = String(cause?.code || '');
  const hint = FETCH_CAUSE[code] || '';
  const raw = String(err?.message || 'fetch failed');
  if (hint) return `${raw}（${code}：${hint}）`;
  const extra = cause?.message && cause.message !== raw ? String(cause.message) : '';
  if (code || extra) return `${raw}（${[ code, extra ].filter(Boolean).join('：')}）`;
  return raw;
}

function wrapAgentError(err, { skill, action, status, message, errorCode }) {
  const wrapped = new Error(message);
  wrapped.status = status;
  wrapped.errorCode = errorCode || '';
  wrapped.skill = skill;
  wrapped.action = action;
  const cause = err?.cause;
  wrapped.detail = [ errorCode, cause?.message && cause.message !== message ? cause.message : '' ].filter(Boolean).join(' ');
  if (cause) wrapped.cause = cause;
  return wrapped;
}

async function invokeSkill(ctx, { skill, action, payload, timeoutMs, signal }) {
  const url = `${platformBase(ctx)}/api/skills/${skill}/invoke`;
  const waitMs = resolveInvokeTimeout(ctx, timeoutMs);
  ctx.logger.info('[cartoon] agent POST %s action=%s timeoutMs=%s', url, action, waitMs);
  // undici 默认 300 秒收不到响应头就断开，短于技能超时，长调用会变成笼统的 fetch failed
  const dispatcher = new Agent({
    headersTimeout: waitMs + 30000,
    bodyTimeout: waitMs + 30000,
    connectTimeout: 15000,
  });
  try {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
        signal: linkSignals([ AbortSignal.timeout(waitMs), signal ]),
        dispatcher,
      });
    } catch (err) {
      if (signal?.aborted) {
        throw wrapAgentError(err, {
          skill,
          action,
          status: 499,
          message: '已停止',
          errorCode: 'AGENT_ABORTED',
        });
      }
      const aborted = err?.name === 'AbortError' || /aborted due to timeout/i.test(String(err?.message || ''));
      const errorCode = aborted ? 'AGENT_TIMEOUT' : String(err?.cause?.code || 'FETCH_FAILED');
      const message = aborted
        ? `Agent 调用超时（${Math.round(waitMs / 1000)} 秒仍未返回，技能 ${skill}/${action}）`
        : `Agent 调用失败：${fetchFailureText(err)}`;
      ctx.logger.error(
        '[cartoon] agent fetch failed skill=%s action=%s code=%s cause=%s',
        skill,
        action,
        errorCode,
        err?.cause?.message || err?.message,
      );
      throw wrapAgentError(err, { skill, action, status: 503, message, errorCode });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || data.message || `Agent HTTP ${res.status}`;
      throw wrapAgentError(null, {
        skill,
        action,
        status: res.status >= 500 ? 502 : res.status,
        message: typeof message === 'string' ? message : `Agent HTTP ${res.status}`,
        errorCode: String(data.code || data.error_code || `HTTP_${res.status}`),
      });
    }
    if (data.output?.stoppedReason === 'no_llm' || data.output?.stoppedReason === 'llm_error') {
      throw wrapAgentError(null, {
        skill,
        action,
        status: 502,
        message: data.output.summary || data.reply || 'Agent 没有完成起草',
        errorCode: String(data.output.stoppedReason),
      });
    }
    return data;
  } finally {
    await dispatcher.close().catch(() => {});
  }
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
