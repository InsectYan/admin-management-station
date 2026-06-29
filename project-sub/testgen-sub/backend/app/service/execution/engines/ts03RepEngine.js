'use strict';

const { emitProgress } = require('../../../lib/fitnessRunEvents');
const BaseTsEngine = require('./baseTsEngine');
const { executeMatrixRow } = require('../runners/matrixRowRunner');

class Ts03RepEngine extends BaseTsEngine {
  constructor() {
    super('TS-03-REP');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { item, runConfig, run } = ctx;
    const configJson = runConfig?.config_json || {};
    const threshold = runConfig?.threshold_json || {};
    const repeatN = Number(
      configJson.repeat_count ?? threshold.passk_N ?? configJson.passk_N ?? 3,
    );

    if (!Number.isFinite(repeatN) || repeatN < 1) {
      const err = new Error('TS-03-REP 需要 repeat_count 或 passk_N ≥ 1');
      err.status = 400;
      err.code = 'REPEAT_COUNT_INVALID';
      throw err;
    }

    const baseRow = configJson.base || {
      runner: configJson.runner || (item.automation_command ? 'cli' : 'http'),
      path: configJson.path || item.endpoint_path,
      method: configJson.method || item.http_method,
      expect_status: configJson.expect_status ?? item.http_status_expected,
      command: configJson.command || item.automation_command,
      headers: configJson.headers,
      body: configJson.body,
    };

    if (baseRow.runner === 'cli' && !baseRow.command && !item.automation_command) {
      const err = new Error('TS-03-REP CLI 模式需要 automation_command 或 config_json.command');
      err.status = 400;
      err.code = 'CLI_NOT_CONFIGURED';
      throw err;
    }
    if (baseRow.runner !== 'cli' && !baseRow.path && !item.endpoint_path) {
      const err = new Error('TS-03-REP HTTP 模式需要 path 或 item.endpoint_path');
      err.status = 400;
      err.code = 'HTTP_NOT_CONFIGURED';
      throw err;
    }

    const results = [];
    let passCount = 0;
    const runId = run.id;

    for (let i = 0; i < repeatN; i += 1) {
      const sub = await executeMatrixRow(ctx, baseRow, i);
      results.push(sub);
      if (sub.sub_verdict === 'pass') passCount += 1;

      if (runId) {
        emitProgress(runId, {
          phase: 'running',
          percent: Math.min(69, Math.round(20 + ((i + 1) / repeatN) * 50)),
          pass_rate: Math.round((passCount / (i + 1)) * 1000) / 10,
          completed: i + 1,
          total: repeatN,
          run_id: runId,
        });
      }
    }

    return results;
  }
}

module.exports = Ts03RepEngine;
