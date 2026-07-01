'use strict';

const BaseTsEngine = require('./baseTsEngine');
const { resolveHttpBody, methodNeedsBody } = require('../../../lib/httpRequestBody');
const { runHttp } = require('../runners/httpRunner');

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class Ts09LoadEngine extends BaseTsEngine {
  constructor() {
    super('TS-09-LOAD');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { item, env, runConfig, run, ctx: eggCtx } = ctx;
    const cfg = runConfig?.config_json || {};
    const thr = runConfig?.threshold_json || {};

    const vu = Math.max(1, Number(cfg.vu ?? 5));
    const durationSec = Math.max(1, Number(cfg.duration_sec ?? 30));
    const path = cfg.path || item.endpoint_path;
    const method = cfg.method || item.http_method || 'GET';
    const p99MaxMs = Number(cfg.p99_max_ms ?? thr.p99_max_ms ?? thr.submit_p99_ms_M ?? 500);
    const errorRateMax = Number(cfg.error_rate_max ?? thr.error_rate_max ?? thr.error_rate_H ?? 1);

    if (!path || !env?.bff_coach_url) {
      const err = new Error('TS-09-LOAD 需要 path 与执行环境 bff_coach_url');
      err.status = 400;
      err.code = 'LOAD_CONFIG_REQUIRED';
      throw err;
    }

    const endAt = Date.now() + durationSec * 1000;
    const samples = [];
    let errors = 0;
    let total = 0;
    const runId = run.id;

    const methodUpper = String(method || 'GET').toUpperCase();
    const requestBody = methodNeedsBody(methodUpper)
      ? resolveHttpBody(methodUpper, cfg)
      : undefined;

    const vuLoop = async () => {
      while (Date.now() < endAt) {
        try {
          const res = await runHttp(eggCtx, {
            baseUrl: env.bff_coach_url,
            path,
            method: methodUpper,
            headers: {
              'X-Test-Run-Id': String(runId),
              'X-Test-Item-Id': item.item_id,
              ...(cfg.headers || {}),
            },
            body: requestBody,
          });
          total += 1;
          const ok = res.statusCode >= 200 && res.statusCode < 400;
          if (!ok) errors += 1;
          samples.push({
            status_code: res.statusCode,
            response_time_ms: res.responseTimeMs,
            ok,
          });
        } catch {
          total += 1;
          errors += 1;
          samples.push({ status_code: 0, response_time_ms: 0, ok: false, error: true });
        }
        await sleep(50);
      }
    };

    await Promise.all(Array.from({ length: vu }, () => vuLoop()));

    const times = samples.map(s => s.response_time_ms).filter(t => t > 0).sort((a, b) => a - b);
    const p50 = percentile(times, 50);
    const p99 = percentile(times, 99);
    const errorRate = total ? (errors / total) * 100 : 0;
    const sloOk = p99 <= p99MaxMs && errorRate <= errorRateMax;

    const perf = {
      vu,
      duration_sec: durationSec,
      path,
      method,
      total_requests: total,
      error_count: errors,
      error_rate_percent: Math.round(errorRate * 100) / 100,
      p50_ms: p50,
      p99_ms: p99,
      p99_max_ms: p99MaxMs,
      error_rate_max_percent: errorRateMax,
      samples: samples.slice(0, 200),
    };

    return [{
      sub_index: 0,
      input_summary: `LOAD ${method} ${path} vu=${vu} ${durationSec}s`,
      output_summary: `p99=${p99}ms err=${errorRate.toFixed(2)}% (${total} req)`,
      sub_verdict: sloOk ? 'pass' : 'fail',
      assertion_detail: [{
        type: 'slo_check',
        p99_ms: p99,
        p99_max_ms: p99MaxMs,
        error_rate_percent: errorRate,
        error_rate_max_percent: errorRateMax,
        ok: sloOk,
      }],
      artifacts: { perf, load: true },
    }];
  }
}

module.exports = Ts09LoadEngine;
