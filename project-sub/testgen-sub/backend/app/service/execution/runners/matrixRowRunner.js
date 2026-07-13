'use strict';

const { mergeRequestHeaders } = require('../../../lib/globalRequestContext');
const { resolveHttpBody, methodNeedsBody } = require('../../../lib/httpRequestBody');
const { extractTraceIdFromHeaders } = require('../../../lib/traceIdExtract');
const { RunStepTracker } = require('../../../lib/runStepTracker');
const { runCli } = require('./cliRunner');
const { runHttp } = require('./httpRunner');

/**
 * @param {import('../runOrchestrator').ExecutionContext} execCtx
 * @param {object} row
 * @param {number} subIndex
 * @param {object} [stepOpts]
 * @param {number} [stepOpts.step_index]
 * @param {string} [stepOpts.source]
 * @param {string} [stepOpts.step_name]
 */
async function executeMatrixRow(execCtx, row, subIndex, stepOpts = {}) {
  const { item, env, run, runConfig, ctx: eggCtx } = execCtx;
  const configJson = runConfig?.config_json || {};
  const runner = row.runner || (row.command ? 'cli' : 'http');
  const runId = run?.id;
  const tracker = runId ? new RunStepTracker(eggCtx, runId) : null;
  const stepIndex = stepOpts.step_index ?? subIndex;

  let stepHandle = null;
  if (tracker) {
    stepHandle = await tracker.begin({
      step_index: stepIndex,
      sub_index: subIndex,
      step_name: stepOpts.step_name || row.name || row.path || row.command || `step-${stepIndex + 1}`,
      runner,
      source: stepOpts.source || 'config',
      input_summary: runner === 'cli'
        ? (row.command || item.automation_command)
        : `${(row.method || row.http_method || item.http_method || configJson.method || 'GET').toUpperCase()} ${row.path || row.endpoint_path || item.endpoint_path || ''}`,
    });
  }

  try {
    if (runner === 'cli') {
      const command = row.command || item.automation_command;
      const cliResult = await runCli(eggCtx, { command, env });
      const ok = cliResult.exitCode === 0;
      const result = {
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
      if (tracker && stepHandle) {
        await tracker.end(stepHandle, {
          status: ok ? 'pass' : 'fail',
          output_summary: result.output_summary,
          detail: { exit_code: cliResult.exitCode },
        });
      }
      return result;
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
    const globalHeaders = execCtx.globalRequestContext?.headers || {};
    const headers = mergeRequestHeaders(globalHeaders, {
      'X-Test-Run-Id': String(run.id),
      'X-Test-Item-Id': item.item_id,
      ...(configJson.headers || {}),
      ...(row.headers || {}),
    });

    const body = methodNeedsBody(method) ? resolveHttpBody(method, row) : undefined;
    const httpResult = await runHttp(eggCtx, {
      baseUrl: env.bff_coach_url,
      path,
      method,
      headers,
      body,
    });

    const statusOk = httpResult.statusCode === Number(expectStatus);
    const traceId = extractTraceIdFromHeaders(httpResult.headers);
    const httpArtifact = { ...httpResult };
    if (traceId) httpArtifact.trace_id = traceId;

    const result = {
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
      artifacts: { http: httpArtifact, ...(traceId ? { trace_id: traceId } : {}) },
    };

    if (tracker && stepHandle) {
      await tracker.end(stepHandle, {
        status: statusOk ? 'pass' : 'fail',
        trace_id: traceId,
        output_summary: result.output_summary,
        detail: {
          status_code: httpResult.statusCode,
          duration_ms: httpResult.responseTimeMs,
        },
      });
    }
    return result;
  } catch (err) {
    if (tracker && stepHandle) {
      await tracker.end(stepHandle, {
        status: 'fail',
        output_summary: err.message,
        detail: { error: err.message, code: err.code },
      });
    }
    throw err;
  }
}

module.exports = { executeMatrixRow };
