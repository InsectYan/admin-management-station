'use strict';

const axios = require('axios');

/**
 * 将 Jaeger span tags 转为键值对象。
 * @param {Array<{ key: string, value: unknown }>} tags
 */
function tagsToMap(tags) {
  const map = {};
  if (!Array.isArray(tags)) return map;
  for (const tag of tags) {
    if (tag?.key) map[tag.key] = tag.value;
  }
  return map;
}

/**
 * 将 Jaeger trace 响应解析为工具调度链路结构。
 * @param {object} traceData Jaeger /api/traces/{id} data[0]
 */
function buildToolChainFromJaegerTrace(traceData) {
  if (!traceData?.spans?.length) {
    return { trace_id: traceData?.traceID || null, spans: [], tool_chain: [], services: [] };
  }

  const processes = traceData.processes || {};
  const spanMap = new Map();

  for (const span of traceData.spans) {
    const parentRef = (span.references || []).find(r => r.refType === 'CHILD_OF');
    const proc = processes[span.processID] || {};
    const tags = tagsToMap(span.tags);
    const durationMs = Math.round((span.duration || 0) / 1000);
    const startMs = Math.round((span.startTime || 0) / 1000);

    const node = {
      span_id: span.spanID,
      trace_id: span.traceID,
      parent_span_id: parentRef?.spanID || null,
      operation_name: span.operationName,
      service_name: proc.serviceName || 'unknown',
      start_time_ms: startMs,
      duration_ms: durationMs,
      kind: classifySpanKind(span.operationName, tags),
      attributes: tags,
      status: tags.error === true || tags['otel.status_code'] === 'ERROR' ? 'error' : 'ok',
    };
    spanMap.set(span.spanID, node);
  }

  const spans = Array.from(spanMap.values()).sort((a, b) => a.start_time_ms - b.start_time_ms);
  const services = [...new Set(spans.map(s => s.service_name))];

  const toolSpans = spans.filter(s => s.kind === 'tool' || s.operation_name === 'pi.tool');
  const tool_chain = toolSpans.map((s, idx) => ({
    order: idx + 1,
    span_id: s.span_id,
    name: s.operation_name,
    tool: s.attributes['pi.tool'] || s.operation_name,
    duration_ms: s.duration_ms,
    status: s.status,
    parent_span_id: s.parent_span_id,
  }));

  return {
    trace_id: traceData.traceID,
    span_count: spans.length,
    services,
    spans,
    tool_chain,
  };
}

function classifySpanKind(operationName, tags) {
  if (operationName === 'pi.tool' || tags['pi.tool']) return 'tool';
  if (operationName.startsWith('pipeline.')) return 'pipeline';
  if (operationName.startsWith('turn.')) return 'worker';
  if (operationName.startsWith('pi.')) return 'agent';
  if (operationName.startsWith('HTTP') || operationName.includes('express')) return 'http';
  return 'other';
}

class OtelTraceQueryService extends require('egg').Service {
  jaegerBaseUrl() {
    const cfg = this.app.config.observability || {};
    return String(cfg.jaegerQueryUrl || 'http://127.0.0.1:16686').replace(/\/$/, '');
  }

  isEnabled() {
    return this.app.config.observability?.enabled !== false;
  }

  /**
   * @param {string} traceId
   */
  async fetchTraceById(traceId) {
    if (!traceId) {
      const err = new Error('trace_id 不能为空');
      err.status = 400;
      err.code = 'TRACE_ID_REQUIRED';
      throw err;
    }
    if (!this.isEnabled()) {
      const err = new Error('可观测链路查询未启用');
      err.status = 503;
      err.code = 'OTEL_QUERY_DISABLED';
      throw err;
    }

    const url = `${this.jaegerBaseUrl()}/api/traces/${encodeURIComponent(traceId)}`;
    try {
      const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
      if (res.status === 404 || !res.data?.data?.length) {
        const err = new Error(`未找到 trace: ${traceId}`);
        err.status = 404;
        err.code = 'TRACE_NOT_FOUND';
        throw err;
      }
      return buildToolChainFromJaegerTrace(res.data.data[0]);
    } catch (err) {
      if (err.status) throw err;
      const wrap = new Error(`Jaeger 查询失败: ${err.message}`);
      wrap.status = 502;
      wrap.code = 'JAEGER_QUERY_FAILED';
      throw wrap;
    }
  }

  /**
   * 从 run 子项 artifacts 收集 trace_id 并批量查询。
   * @param {object} run
   */
  async fetchTracesForRun(run) {
    const traceIds = new Set();
    for (const result of run.results || []) {
      const wrapped = result.assertion_detail;
      const artifacts = result.artifacts
        || (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped) ? wrapped.artifacts : null);
      const tid = artifacts?.http?.trace_id || artifacts?.trace_id;
      if (tid) traceIds.add(String(tid).toLowerCase());
    }
    for (const step of run.steps || []) {
      if (step.trace_id) traceIds.add(String(step.trace_id).toLowerCase());
    }

    const traces = [];
    const errors = [];
    for (const traceId of traceIds) {
      try {
        const chain = await this.fetchTraceById(traceId);
        traces.push(chain);
      } catch (err) {
        errors.push({ trace_id: traceId, error: err.message, code: err.code });
      }
    }

    return {
      run_id: run.id,
      trace_ids: [...traceIds],
      traces,
      errors,
    };
  }
}

module.exports = OtelTraceQueryService;
