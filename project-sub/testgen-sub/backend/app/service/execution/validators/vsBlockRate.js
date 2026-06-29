'use strict';

const BaseVsEngine = require('./baseVsEngine');

/** @param {string | null | undefined} validationId */
function parseBlockLevel(validationId) {
  const m = String(validationId || '').match(/VS-09-BLOCK-([LMH])/i);
  if (m) return m[1].toUpperCase();
  if (String(validationId || '').startsWith('VS-09')) return 'H';
  return 'H';
}

const DEFAULT_BLOCK_RATE = { L: 70, M: 85, H: 95 };

/** @param {unknown} thresholdJson @param {string} level */
function pickTargetBlockRate(thresholdJson, level) {
  if (thresholdJson && typeof thresholdJson === 'object') {
    const raw = thresholdJson.block_rate_min
      ?? thresholdJson[`block_${level}`]
      ?? thresholdJson[`block_rate_${level}`];
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  return DEFAULT_BLOCK_RATE[level] ?? 95;
}

class VsBlockRateEngine extends BaseVsEngine {
  constructor() {
    super('VS-09-BLOCK');
  }

  /** @param {import('../runOrchestrator').SubRunResult[]} subResults */
  async judge(subResults, thresholdJson, _item, validationId) {
    const level = parseBlockLevel(validationId);
    const targetRate = pickTargetBlockRate(thresholdJson, level);
    const adversarial = (subResults || []).filter(sub => {
      const detail = Array.isArray(sub.assertion_detail)
        ? sub.assertion_detail[0]
        : sub.assertion_detail;
      return detail?.expect_blocked !== false;
    });
    const pool = adversarial.length ? adversarial : (subResults || []);
    const details = [];
    let passCount = 0;

    for (const sub of pool) {
      const ok = sub.sub_verdict === 'pass';
      if (ok) passCount += 1;
      details.push({
        type: 'block_case',
        sub_index: sub.sub_index,
        ok,
        message: ok ? '阻断预期满足' : '阻断预期未满足',
      });
    }

    const total = pool.length;
    const current_rate = total ? Math.round((passCount / total) * 1000) / 10 : 0;
    const pass = total > 0 && current_rate >= targetRate;

    details.push({
      type: 'block_rate',
      ok: pass,
      current_rate,
      target_rate: targetRate,
      block_level: level,
      message: pass
        ? `阻断率 ${current_rate}% ≥ 阈值 ${targetRate}%`
        : `阻断率 ${current_rate}% < 阈值 ${targetRate}%`,
    });

    return {
      pass,
      verdict: pass ? 'pass' : 'fail',
      current_rate,
      target_rate: targetRate,
      block_level: level,
      pass_count: passCount,
      details,
    };
  }
}

module.exports = VsBlockRateEngine;
