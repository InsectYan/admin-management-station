'use strict';

/**
 * 从 Agent Skill 响应中提取 tool 调用列表（供审计与链路联动）。
 * @param {object} data
 * @returns {Array<{ name: string, kind?: string, duration_ms?: number, status?: string }>}
 */
function extractAgentTools(data) {
  if (!data || typeof data !== 'object') return [];

  const candidates = [
    data.output?.tool_calls,
    data.output?.tools,
    data.tools,
    data.tool_calls,
  ];
  for (const list of candidates) {
    if (!Array.isArray(list) || !list.length) continue;
    return list.map((t, idx) => ({
      order: idx + 1,
      name: t.name || t.tool || t.toolName || t.id || `tool-${idx + 1}`,
      kind: t.kind || t.type || 'tool',
      duration_ms: t.duration_ms ?? t.durationMs ?? null,
      status: t.status || (t.ok === false ? 'error' : 'ok'),
      input: t.input || t.args || null,
      output: t.output || t.result || null,
    }));
  }

  if (Array.isArray(data.steps)) {
    return data.steps
      .filter(s => s.kind === 'tool' || s.type === 'tool' || s.tool)
      .map((s, idx) => ({
        order: idx + 1,
        name: s.tool || s.name || s.label || `step-${idx + 1}`,
        kind: 'tool',
        duration_ms: s.duration_ms ?? s.durationMs ?? null,
        status: s.status || 'ok',
      }));
  }

  return [];
}

module.exports = { extractAgentTools };
