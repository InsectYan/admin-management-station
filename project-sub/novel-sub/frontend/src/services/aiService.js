import { api, resolveApiBase } from './apiConfig.js';

async function request(path, options = {}) {
  const res = await api({
    url: `${resolveApiBase()}${path}`,
    ...options,
  });
  return res.data?.data;
}

export function listAiSessions(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== '' && val != null) qs.set(key, String(val));
  });
  const q = qs.toString();
  return request(`/ai/sessions${q ? `?${q}` : ''}`);
}

export function createAiSession(payload) {
  return request('/ai/sessions', { method: 'POST', data: payload });
}

export function updateAiSession(id, payload) {
  return request(`/ai/sessions/${id}`, { method: 'PATCH', data: payload });
}

export function listAiMessages(sessionId) {
  return request(`/ai/sessions/${sessionId}/messages`);
}

export function postAiTurn(sessionId, payload) {
  return request(`/ai/sessions/${sessionId}/turns`, {
    method: 'POST',
    data: payload,
    timeout: 180000,
  });
}

export function applyAiMessage(sessionId, payload) {
  return request(`/ai/sessions/${sessionId}/apply`, { method: 'POST', data: payload });
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

export async function streamAiTurn(sessionId, payload, handlers = {}) {
  const { onThinking, onDone, onError, signal } = handlers;
  const url = `${resolveApiBase()}/ai/sessions/${sessionId}/turns/stream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    let message = text || `生成失败 HTTP ${res.status}`;
    try {
      const json = JSON.parse(text);
      if (json?.message) message = json.message;
    } catch {
      /* keep */
    }
    const err = new Error(message);
    onError?.(err);
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let settled = false;

  const flush = (block) => {
    const parsed = parseSseBlock(block);
    if (!parsed) return;
    const { event, data } = parsed;
    if (event === 'thinking' || event === 'status' || event === 'delta') {
      onThinking?.(data);
      return;
    }
    if (event === 'done') {
      settled = true;
      onDone?.(data);
      return;
    }
    if (event === 'error') {
      settled = true;
      const err = new Error(data?.message || '生成失败');
      err.code = data?.code;
      onError?.(err);
      throw err;
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
    if (!settled) {
      const err = new Error('生成中断，未收到完成结果');
      onError?.(err);
      throw err;
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    if (!settled) onError?.(err);
    throw err;
  }
}
