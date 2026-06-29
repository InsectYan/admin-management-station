'use strict';

const { emitProgress } = require('../../../lib/fitnessRunEvents');
const BaseTsEngine = require('./baseTsEngine');
const { executePairArm } = require('../runners/pairArmRunner');

class Ts06PairEngine extends BaseTsEngine {
  constructor() {
    super('TS-06-PAIR');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { runConfig, run } = ctx;
    let pairs = runConfig?.config_json?.pairs;
    if (!Array.isArray(pairs) || !pairs.length) {
      pairs = [
        { role: 'coach', path: '/health', method: 'GET', expect_status: 200 },
        { role: 'member', path: '/health', method: 'GET', expect_status: 200 },
        { role: 'manager', path: '/health', method: 'GET', expect_status: 200 },
      ];
    }

    const results = [];
    let passCount = 0;
    const total = pairs.length;
    const runId = run.id;

    for (let i = 0; i < pairs.length; i += 1) {
      const sub = await executePairArm(ctx, pairs[i], i);
      results.push(sub);
      if (sub.sub_verdict === 'pass') passCount += 1;

      if (runId) {
        emitProgress(runId, {
          phase: 'running',
          percent: Math.min(69, Math.round(20 + ((i + 1) / total) * 50)),
          pass_rate: Math.round((passCount / (i + 1)) * 1000) / 10,
          completed: i + 1,
          total,
          run_id: runId,
        });
      }
    }

    return results;
  }
}

module.exports = Ts06PairEngine;
