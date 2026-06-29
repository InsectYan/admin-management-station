'use strict';

const BaseVsEngine = require('./baseVsEngine');

class VsPassKEngine extends BaseVsEngine {
  constructor() {
    super('VS-08-PASSK');
  }

  /** @param {import('../runOrchestrator').SubRunResult[]} subResults */
  async judge(subResults, thresholdJson, _item, _validationId) {
    const passkN = Number(thresholdJson?.passk_N ?? subResults?.length ?? 0);
    const passkM = Number(thresholdJson?.passk_M ?? passkN);
    const details = [];
    let passCount = 0;

    for (const sub of subResults || []) {
      const ok = sub.sub_verdict === 'pass';
      if (ok) passCount += 1;
      details.push({
        type: 'sub_verdict',
        sub_index: sub.sub_index,
        ok,
        message: ok ? '重复项通过' : '重复项失败',
      });
    }

    const total = subResults?.length || 0;
    const pass = total > 0 && passCount >= passkM;
    const current_rate = total ? Math.round((passCount / total) * 1000) / 10 : 0;

    details.push({
      type: 'passk',
      ok: pass,
      pass_count: passCount,
      passk_N: passkN,
      passk_M: passkM,
      message: pass
        ? `通过 ${passCount}/${total} 次 ≥ M=${passkM}`
        : `通过 ${passCount}/${total} 次 < M=${passkM}`,
    });

    return {
      pass,
      verdict: pass ? 'pass' : 'fail',
      current_rate,
      pass_count: passCount,
      passk_N: passkN,
      passk_M: passkM,
      target_rate: passkN ? Math.round((passkM / passkN) * 1000) / 10 : 100,
      details,
    };
  }
}

module.exports = VsPassKEngine;
