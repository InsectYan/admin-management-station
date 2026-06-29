'use strict';

const BaseTsEngine = require('./baseTsEngine');
const { runCli } = require('../runners/cliRunner');
const { runHttp } = require('../runners/httpRunner');

class Ts01DetEngine extends BaseTsEngine {
  constructor() {
    super('TS-01-DET');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { item, env, run } = ctx;
    const configJson = ctx.runConfig?.config_json || {};

    if (item.automation_command) {
      const cliResult = await runCli(ctx.ctx, {
        command: item.automation_command,
      });
      const outputTail = (cliResult.stdout || cliResult.stderr || '').slice(-2000);
      return [{
        sub_index: 0,
        input_summary: cliResult.command,
        output_summary: `exit=${cliResult.exitCode} (${cliResult.durationMs}ms)`,
        assertion_detail: {
          runner: 'cli',
          exit_code: cliResult.exitCode,
          duration_ms: cliResult.durationMs,
          stdout_tail: cliResult.stdout?.slice(-1500),
          stderr_tail: cliResult.stderr?.slice(-500),
        },
        sub_verdict: cliResult.exitCode === 0 ? 'pass' : 'fail',
        artifacts: { cli: cliResult, output_tail: outputTail },
      }];
    }

    if (item.endpoint_path && env?.bff_coach_url) {
      const headers = {
        'X-Test-Run-Id': String(run.id),
        'X-Test-Item-Id': item.item_id,
        ...(configJson.headers || {}),
      };
      const httpResult = await runHttp(ctx.ctx, {
        baseUrl: env.bff_coach_url,
        path: item.endpoint_path,
        method: item.http_method || configJson.method || 'GET',
        headers,
        body: configJson.body,
      });
      const assertions = configJson.assertions || [];
      if (!assertions.length && item.http_status_expected != null) {
        assertions.push({ type: 'status', expect: item.http_status_expected });
      }
      const { passed, details } = await ctx.ctx.service.executionEngine.runAssertions(assertions, {
        statusCode: httpResult.statusCode,
        body: httpResult.body,
        responseTimeMs: httpResult.responseTimeMs,
      });
      return [{
        sub_index: 0,
        input_summary: `${httpResult.method} ${httpResult.url}`,
        output_summary: `HTTP ${httpResult.statusCode} (${httpResult.responseTimeMs}ms)`,
        assertion_detail: details,
        sub_verdict: passed ? 'pass' : 'fail',
        artifacts: { http: httpResult },
      }];
    }

    const err = new Error('用例既无 automation_command 也无 endpoint_path，无法执行 TS-01-DET');
    err.status = 400;
    err.code = 'RUNNER_NOT_AVAILABLE';
    throw err;
  }
}

module.exports = Ts01DetEngine;
