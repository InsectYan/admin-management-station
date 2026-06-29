'use strict';

const BaseVsEngine = require('./baseVsEngine');

class VsZeroEngine extends BaseVsEngine {
  constructor() {
    super('VS-03-ZERO');
  }

  /** @param {import('../runOrchestrator').SubRunResult[]} subResults */
  async judge(subResults) {
    const details = [];
    let passCount = 0;
    const total = subResults?.length || 0;

    for (const sub of subResults || []) {
      const ok = sub.sub_verdict === 'pass';
      if (ok) passCount += 1;
      details.push({
        type: 'zero_violation',
        sub_index: sub.sub_index,
        ok,
        message: ok ? '零违规' : '存在违规子项',
      });
    }

    const pass = total > 0 && passCount === total;
    return {
      pass,
      verdict: pass ? 'pass' : 'fail',
      pass_count: passCount,
      total,
      current_rate: total ? 100 : 0,
      target_rate: 100,
      details,
    };
  }
}

module.exports = VsZeroEngine;
