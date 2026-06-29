'use strict';

const BaseVsEngine = require('./baseVsEngine');

class VsChainEngine extends BaseVsEngine {
  constructor() {
    super('VS-04-CHAIN-OK');
  }

  /** @param {import('../runOrchestrator').SubRunResult[]} subResults */
  async judge(subResults, _thresholdJson, _item, _validationId) {
    const details = [];
    let passCount = 0;
    const total = subResults?.length || 0;

    for (const sub of subResults || []) {
      const ok = sub.sub_verdict === 'pass';
      if (ok) passCount += 1;
      details.push({
        type: 'chain_step',
        sub_index: sub.sub_index,
        ok,
        message: ok ? '链路步骤通过' : '链路步骤失败',
      });
    }

    const pass = total > 0 && passCount === total;
    const current_rate = total ? Math.round((passCount / total) * 1000) / 10 : 0;

    return {
      pass,
      verdict: pass ? 'pass' : 'fail',
      current_rate,
      target_rate: 100,
      details,
    };
  }
}

module.exports = VsChainEngine;
