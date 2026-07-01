'use strict';

const { resolveHttpBody, methodNeedsBody } = require('../../../lib/httpRequestBody');
const { runCli } = require('./cliRunner');
const { runHttp } = require('./httpRunner');

/**
 * @param {import('../runOrchestrator').ExecutionContext} execCtx
 * @param {object} row
 * @param {number} subIndex
 */
async function executeMatrixRow(execCtx, row, subIndex) {
  const { item, env, run, runConfig, ctx: eggCtx } = execCtx;
  const configJson = runConfig?.config_json || {};
  const runner = row.runner || (row.command ? 'cli' : 'http');

  if (runner === 'cli') {
    const command = row.command || item.automation_command;
    const cliResult = await runCli(eggCtx, { command, env });
    const ok = cliResult.exitCode === 0;
    return {
      sub_index: subIndex,
      input_summary: cliResult.command,
      output_summary: `exit=${cliResult.exitCode} (${cliResult.durationMs}ms)`,
      assertion_detail: {
        runner: 'cli',
        exit_code: cliResult.exitCode,
        duration_ms: cliResult.durationMs,
      },
      sub_verdict: ok ? 'pass' : 'fail',
      artifacts: { cli: cliResult },
    };
  }

  if (!env?.bff_coach_url) {
    const err = new Error('执行环境未配置 bff_coach_url');
    err.status = 400;
    err.code = 'ENV_NOT_CONFIGURED';
    throw err;
  }

  const path = row.path || row.endpoint_path || item.endpoint_path;
  if (!path) {
    const err = new Error(`矩阵行 #${subIndex + 1} 缺少 path`);
    err.status = 400;
    err.code = 'MATRIX_ROW_INVALID';
    throw err;
  }

  const method = (row.method || row.http_method || item.http_method || configJson.method || 'GET').toUpperCase();
  const expectStatus = row.expect_status ?? row.http_status_expected ?? item.http_status_expected ?? 200;
  const headers = {
    'X-Test-Run-Id': String(run.id),
    'X-Test-Item-Id': item.item_id,
    ...(configJson.headers || {}),
    ...(row.headers || {}),
  };

  const body = methodNeedsBody(method) ? resolveHttpBody(method, row) : undefined;
  const httpResult = await runHttp(eggCtx, {
    baseUrl: env.bff_coach_url,
    path,
    method,
    headers,
    body,
  });

  const statusOk = httpResult.statusCode === Number(expectStatus);
  return {
    sub_index: subIndex,
    input_summary: `${method} ${path} (expect ${expectStatus})`,
    output_summary: `HTTP ${httpResult.statusCode} (${httpResult.responseTimeMs}ms)`,
    assertion_detail: [{
      type: 'status',
      expect: expectStatus,
      actual: httpResult.statusCode,
      ok: statusOk,
      message: statusOk ? 'status match' : `expected ${expectStatus}, got ${httpResult.statusCode}`,
    }],
    sub_verdict: statusOk ? 'pass' : 'fail',
    artifacts: { http: httpResult },
  };
}

module.exports = { executeMatrixRow };
