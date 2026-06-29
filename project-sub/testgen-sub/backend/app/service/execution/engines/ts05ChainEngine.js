'use strict';

const { emitProgress } = require('../../../lib/fitnessRunEvents');
const BaseTsEngine = require('./baseTsEngine');
const { executeMatrixRow } = require('../runners/matrixRowRunner');
const { applyExtract, applyVarsToRow } = require('../runners/varPool');

class Ts05ChainEngine extends BaseTsEngine {
  constructor() {
    super('TS-05-CHAIN');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { runConfig, run } = ctx;
    const steps = runConfig?.config_json?.steps;
    if (!Array.isArray(steps) || !steps.length) {
      const err = new Error('TS-05-CHAIN 需要 config_json.steps 非空');
      err.status = 400;
      err.code = 'CHAIN_STEPS_REQUIRED';
      throw err;
    }

    /** @type {Record<string, unknown>} */
    const vars = { ...(runConfig?.config_json?.vars || {}) };
    const results = [];
    let passCount = 0;
    const total = steps.length;
    const runId = run.id;

    for (let i = 0; i < steps.length; i += 1) {
      const rawStep = steps[i];
      const row = applyVarsToRow(rawStep, vars);
      const sub = await executeMatrixRow(ctx, row, i);

      if (sub.artifacts?.http?.body && rawStep.extract) {
        applyExtract(vars, sub.artifacts.http.body, rawStep.extract);
        sub.artifacts.vars = { ...vars };
      }

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

      if (sub.sub_verdict !== 'pass' && rawStep.stop_on_fail !== false) {
        break;
      }
    }

    return results;
  }
}

module.exports = Ts05ChainEngine;
