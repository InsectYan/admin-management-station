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

function parseSseBlock(block) {
  const lines = String(block || '').split(/\r?\n/);
  let event = 'message';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return null;
  let data;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    data = { raw: dataLines.join('\n') };
  }
  return { event, data };
}

function bindClientAbort(ctx, controller) {
  const req = ctx.req;
  const res = ctx.res;
  if (!req && !res) return () => {};
  const onClose = () => {
    try { controller.abort(); } catch { /* ignore */ }
  };
  req?.on?.('close', onClose);
  req?.on?.('aborted', onClose);
  res?.on?.('close', onClose);
  return () => {
    req?.off?.('close', onClose);
    req?.off?.('aborted', onClose);
    res?.off?.('close', onClose);
  };
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

async function invokeSkillStream(ctx, { skill, action, payload, timeoutMs, onEvent }) {
  const { config, base } = platformBase(ctx);
  const url = `${base}/api/skills/${skill}/invoke-stream`;
  const traceId = payload.trace_id || newTraceId();
  const timeout = timeoutMs || config.timeoutMs || 600000;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const unbindClient = bindClientAbort(ctx, controller);

  ctx.logger.info('[agentProxy] STREAM %s action=%s trace=%s', url, action, traceId);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        action,
        ...payload,
        stream: true,
        trace_id: traceId,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    unbindClient();
    if (err?.name === 'AbortError') {
      const closed = ctx.req?.destroyed || ctx.req?.aborted;
      const wrapped = new Error(closed
        ? '客户端已断开，已停止 Agent 调用'
        : `Agent 流式调用超时（${timeout}ms）`);
      wrapped.status = 504;
      wrapped.code = 'AGENT_STREAM_TIMEOUT';
      throw wrapped;
    }
    const wrapped = new Error(`Agent 流式调用失败：${err.message}`);
    wrapped.status = 503;
    wrapped.code = 'AGENT_UNREACHABLE';
    throw wrapped;
  }

  if (!res.ok || !res.body) {
    clearTimeout(timer);
    unbindClient();
    const text = await res.text().catch(() => '');
    const wrapped = new Error(text || `Agent 流式 HTTP ${res.status}`);
    wrapped.status = res.status >= 500 ? 502 : res.status;
    wrapped.code = 'AGENT_STREAM_FAILED';
    throw wrapped;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let doneData = null;

  const flush = (block) => {
    const parsed = parseSseBlock(block);
    if (!parsed) return;
    if (parsed.event === 'done') doneData = parsed.data;
    if (typeof onEvent === 'function') {
      try {
        onEvent(parsed.event, parsed.data);
      } catch {
        /* ignore consumer */
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        flush(block);
      }
    }
    if (buffer.trim()) flush(buffer);
  } catch (err) {
    if (err?.name === 'AbortError') {
      const closed = ctx.req?.destroyed || ctx.req?.aborted;
      const wrapped = new Error(closed
        ? '客户端已断开，已停止 Agent 调用'
        : `Agent 流式调用超时（${timeout}ms）`);
      wrapped.status = 504;
      wrapped.code = 'AGENT_STREAM_TIMEOUT';
      throw wrapped;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    unbindClient();
  }

  const elapsed = Date.now() - started;
  ctx.logger.info('[agentProxy] STREAM %s done %sms', skill, elapsed);

  if (!doneData) {
    const err = new Error('Agent 流式未返回完成事件');
    err.status = 502;
    err.code = 'AGENT_STREAM_INCOMPLETE';
    throw err;
  }

  return {
    data: doneData,
    traceId,
    elapsed,
  };
}

async function generateMedia(ctx, { kind, prompt, mediaProfile, size, timeoutMs }) {
  const { config, base } = platformBase(ctx);
  const url = `${base}/api/media/generate`;
  const timeout = timeoutMs || config.timeoutMs || 600000;
  const started = Date.now();

  ctx.logger.info('[agentProxy] POST %s kind=%s profile=%s', url, kind, mediaProfile || '(default)');

  let result;
  try {
    result = await ctx.curl(url, {
      method: 'POST',
      contentType: 'json',
      dataType: 'json',
      timeout,
      data: {
        kind: kind || 'image',
        prompt,
        media_profile: mediaProfile,
        size,
      },
    });
  } catch (err) {
    const wrapped = new Error(`多模态生成失败：${err.message}`);
    wrapped.status = 503;
    wrapped.code = 'AGENT_UNREACHABLE';
    wrapped.cause = err;
    throw wrapped;
  }

  const elapsed = Date.now() - started;
  ctx.logger.info('[agentProxy] media generate HTTP %s %sms', result.status, elapsed);

  if (result.status >= 400) {
    const msg = result.data?.error || result.data?.message || `Agent HTTP ${result.status}`;
    const wrapped = new Error(msg);
    wrapped.status = result.status >= 500 ? 502 : result.status;
    wrapped.code = result.data?.code || 'MEDIA_GENERATE_FAILED';
    wrapped.data = result.data;
    throw wrapped;
  }

  return {
    data: result.data,
    elapsed,
  };
}

module.exports = {
  invokeSkill,
  invokeSkillStream,
  generateMedia,
  newTraceId,
};
