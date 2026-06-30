'use strict';

const BaseVsEngine = require('./baseVsEngine');

class VsSloEngine extends BaseVsEngine {
  constructor() {
    super('VS-10-SLO');
  }

  /** @param {import('../runOrchestrator').SubRunResult} sub */
  extractPerf(sub) {
    if (!sub) return null;
    if (sub.artifacts?.perf) return sub.artifacts.perf;
    const detail = sub.assertion_detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail) && detail.artifacts?.perf) {
      return detail.artifacts.perf;
    }
    return null;
  }

  /** @param {import('../runOrchestrator').SubRunResult[]} subResults */
  async judge(subResults, thresholdJson, _item, _validationId) {
    const sub = subResults?.[0];
    const perf = this.extractPerf(sub);
    const p99Max = Number(
      thresholdJson?.p99_max_ms ?? thresholdJson?.submit_p99_ms_M ?? perf?.p99_max_ms ?? 500,
    );
    const errorRateMax = Number(
      thresholdJson?.error_rate_max ?? thresholdJson?.error_rate_H ?? perf?.error_rate_max_percent ?? 1,
    );

    if (!perf) {
      const pass = sub?.sub_verdict === 'pass';
      return {
        pass,
        verdict: pass ? 'pass' : 'fail',
        details: [{ type: 'slo', ok: pass, message: '无 perf 指标，回退 sub_verdict' }],
      };
    }

    const p99Ok = perf.p99_ms <= p99Max;
    const errOk = perf.error_rate_percent <= errorRateMax;
    const pass = p99Ok && errOk;

    return {
      pass,
      verdict: pass ? 'pass' : 'fail',
      details: [
        {
          type: 'p99',
          ok: p99Ok,
          value: perf.p99_ms,
          threshold: p99Max,
          message: p99Ok
            ? `p99 ${perf.p99_ms}ms ≤ ${p99Max}ms`
            : `p99 ${perf.p99_ms}ms > ${p99Max}ms`,
        },
        {
          type: 'error_rate',
          ok: errOk,
          value: perf.error_rate_percent,
          threshold: errorRateMax,
          message: errOk
            ? `错误率 ${perf.error_rate_percent}% ≤ ${errorRateMax}%`
            : `错误率 ${perf.error_rate_percent}% > ${errorRateMax}%`,
        },
      ],
    };
  }
}

module.exports = VsSloEngine;
