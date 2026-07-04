'use strict';

/**
 * 从 HTTP 响应头提取 OpenTelemetry trace_id。
 * 优先 W3C traceparent，其次 X-Trace-Id。
 * @param {Record<string, string | string[] | undefined>} headers
 * @returns {string | null}
 */
function extractTraceIdFromHeaders(headers) {
  if (!headers || typeof headers !== 'object') return null;

  const traceparent = headers.traceparent || headers.Traceparent;
  if (typeof traceparent === 'string' && traceparent) {
    const parts = traceparent.split('-');
    if (parts.length >= 2 && parts[1]) return parts[1].toLowerCase();
  }

  const xTrace = headers['x-trace-id'] || headers['X-Trace-Id'];
  if (typeof xTrace === 'string' && xTrace) return xTrace.toLowerCase();

  return null;
}

module.exports = { extractTraceIdFromHeaders };
