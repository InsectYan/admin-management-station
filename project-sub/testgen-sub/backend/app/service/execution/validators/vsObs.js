'use strict';

const BaseVsEngine = require('./baseVsEngine');

class VsObsEngine extends BaseVsEngine {
  constructor() {
    super('VS-OBS');
  }

  /** @param {import('../runOrchestrator').SubRunResult[]} subResults */
  async judge(subResults, thresholdJson, _item, validationId) {
    const details = [];
    let passCount = 0;
    const total = subResults?.length || 0;
    const requireAll = validationId === 'VS-06-COMPLETE'
      || thresholdJson?.require_complete === true;

    for (const sub of subResults || []) {
      let ok = sub.sub_verdict === 'pass';
      const detail = sub.assertion_detail;
      const assertions = Array.isArray(detail) ? detail : (detail?.assertions || []);
      const artifacts = sub.artifacts || detail?.artifacts;

      if (ok && Array.isArray(assertions)) {
        for (const row of assertions) {
          details.push(row);
          if (row.ok === false) ok = false;
        }
      }

      if (requireAll && artifacts?.journey?.journey?.stations) {
        const stations = artifacts.journey.journey.stations;
        const stationOk = Array.isArray(stations) && stations.length > 0;
        details.push({
          type: 'journey_stations',
          ok: stationOk,
          message: stationOk ? `stations=${stations.length}` : 'journey.stations 为空',
        });
        if (!stationOk) ok = false;
      }

      details.push({
        type: 'sub_verdict',
        sub_index: sub.sub_index,
        ok,
        message: ok ? '可观测子项通过' : '可观测子项失败',
      });
      if (ok) passCount += 1;
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

module.exports = VsObsEngine;
