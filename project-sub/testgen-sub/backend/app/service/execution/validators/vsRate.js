'use strict';

const BaseVsEngine = require('./baseVsEngine');

/** @param {string | null | undefined} validationId */
function parseRateLevel(validationId) {
  const m = String(validationId || '').match(/VS-07-RATE-([LMH])/i);
  if (m) return m[1].toUpperCase();
  if (String(validationId || '').startsWith('VS-07')) return 'M';
  return 'M';
}

/** @param {unknown} thresholdJson @param {string} rateLevel */
function pickTargetPassRate(thresholdJson, rateLevel) {
  if (!thresholdJson || typeof thresholdJson !== 'object') return null;
  const key = `rate_${rateLevel}`;
  const raw = thresholdJson[key] ?? thresholdJson[key.toLowerCase()];
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

class VsRateEngine extends BaseVsEngine {
  constructor() {
    super('VS-07-RATE');
  }

  /** @param {import('../runOrchestrator').SubRunResult[]} subResults */
  async judge(subResults, thresholdJson, _item, validationId) {
    const rateLevel = parseRateLevel(validationId);
    const targetRate = pickTargetPassRate(thresholdJson, rateLevel);
    const details = [];
    let passCount = 0;
    const total = subResults?.length || 0;

    for (const sub of subResults || []) {
      const ok = sub.sub_verdict === 'pass';
      if (ok) passCount += 1;
      details.push({
        type: 'sub_verdict',
        sub_index: sub.sub_index,
        ok,
        message: ok ? '子项通过' : '子项失败',
      });
    }

    const current_rate = total ? Math.round((passCount / total) * 1000) / 10 : 0;
    const target_rate = targetRate ?? 100;
    const pass = total > 0 && current_rate >= target_rate;

    details.push({
      type: 'pass_rate',
      ok: pass,
      current_rate,
      target_rate,
      rate_level: rateLevel,
      message: pass
        ? `达标率 ${current_rate}% ≥ 阈值 ${target_rate}%`
        : `达标率 ${current_rate}% < 阈值 ${target_rate}%`,
    });

    return {
      pass,
      verdict: pass ? 'pass' : 'fail',
      current_rate,
      target_rate,
      rate_level: rateLevel,
      details,
    };
  }
}

module.exports = VsRateEngine;
