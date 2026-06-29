'use strict';

const { emitProgress } = require('../../../lib/fitnessRunEvents');
const BaseTsEngine = require('./baseTsEngine');
const { executeMatrixRow } = require('../runners/matrixRowRunner');

class Ts02BndEngine extends BaseTsEngine {
  constructor() {
    super('TS-02-BND');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { runConfig, run } = ctx;
    const matrix = runConfig?.config_json?.matrix;
    if (!Array.isArray(matrix) || !matrix.length) {
      const err = new Error('TS-02-BND 需要 config_json.matrix 非空，请先在方案配置页保存');
      err.status = 400;
      err.code = 'MATRIX_REQUIRED';
      throw err;
    }

    const results = [];
    let passCount = 0;
    const total = matrix.length;
    const runId = run.id;

    for (let i = 0; i < matrix.length; i += 1) {
      const sub = await executeMatrixRow(ctx, matrix[i], i);
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

module.exports = Ts02BndEngine;
