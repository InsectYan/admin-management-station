import { resolveAgentApiBase } from './apiConfig.js';

const AGENT_BASE = resolveAgentApiBase();

function parseSseBlock(block) {
  const lines = block.split('\n');
  let event = 'message';
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}

/**
 * POST /api/chat SSE（对齐 cartoon-agent AgentSseStream 契约）
 */
export async function streamAgentChat(body, handlers = {}) {
  const res = await fetch(`${AGENT_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      panel_mode: 'develop',
      user_id: 'default',
      ...body,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Agent HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('SSE not supported');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const parsed = parseSseBlock(part);
      if (!parsed) continue;
      if (parsed.event === 'status') handlers.onStatus?.(parsed.data);
      if (parsed.event === 'delta') handlers.onDelta?.(parsed.data);
      if (parsed.event === 'message') handlers.onMessage?.(parsed.data);
      if (parsed.event === 'done') handlers.onDone?.(parsed.data);
      if (parsed.event === 'error') handlers.onError?.(parsed.data);
    }
  }
}

export async function fetchLlmProfiles() {
  const res = await fetch(`${AGENT_BASE}/api/llm/profiles`);
  return res.json();
}
