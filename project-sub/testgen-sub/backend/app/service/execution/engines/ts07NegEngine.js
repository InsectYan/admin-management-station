'use strict';

const { emitProgress } = require('../../../lib/fitnessRunEvents');
const BaseTsEngine = require('./baseTsEngine');
const { resolveHttpBody, methodNeedsBody } = require('../../../lib/httpRequestBody');
const { runHttp } = require('../runners/httpRunner');
const { isBlockedStatus, scanForbidden } = require('../runners/forbiddenScan');

class Ts07NegEngine extends BaseTsEngine {
  constructor() {
    super('TS-07-NEG');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { item, env, run, runConfig, ctx: eggCtx } = ctx;
    const cases = runConfig?.config_json?.cases;
    if (!Array.isArray(cases) || !cases.length) {
      const err = new Error('TS-07-NEG 需要 config_json.cases 非空');
      err.status = 400;
      err.code = 'NEG_CASES_REQUIRED';
      throw err;
    }

    if (!env?.bff_coach_url) {
      const err = new Error('执行环境未配置 bff_coach_url');
      err.status = 400;
      err.code = 'ENV_NOT_CONFIGURED';
      throw err;
    }

    const configJson = runConfig?.config_json || {};
    const results = [];
    let passCount = 0;
    const total = cases.length;
    const runId = run.id;

    for (let i = 0; i < cases.length; i += 1) {
      const c = cases[i];
      const path = c.path || c.endpoint_path;
      if (!path) {
        const err = new Error(`对抗用例 #${i + 1} 缺少 path`);
        err.status = 400;
        err.code = 'NEG_CASE_INVALID';
        throw err;
      }

      const method = (c.method || 'GET').toUpperCase();
      const expectBlocked = c.expect_blocked !== false;
      const blockStatuses = c.block_statuses || configJson.block_statuses;
      const blockPatterns = c.block_body_patterns || configJson.block_body_patterns || [];
      const headers = {
        'X-Test-Run-Id': String(run.id),
        'X-Test-Item-Id': item.item_id,
        ...(configJson.headers || {}),
        ...(c.headers || {}),
      };

      const body = methodNeedsBody(method) ? resolveHttpBody(method, c) : undefined;
      const httpResult = await runHttp(eggCtx, {
        baseUrl: env.bff_coach_url,
        path,
        method,
        headers,
        body,
      });

      const statusBlocked = isBlockedStatus(httpResult.statusCode, blockStatuses);
      const patternBlocked = !!scanForbidden(httpResult.body, blockPatterns);
      const blocked = statusBlocked || patternBlocked;
      const met = expectBlocked ? blocked : !blocked;

      if (met) passCount += 1;

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

      results.push({
        sub_index: i,
        input_summary: `${method} ${path} (expect ${expectBlocked ? 'blocked' : 'allowed'})`,
        output_summary: blocked
          ? `blocked HTTP ${httpResult.statusCode}`
          : `allowed HTTP ${httpResult.statusCode}`,
        assertion_detail: [{
          type: 'adversarial',
          expect_blocked: expectBlocked,
          blocked,
          status_code: httpResult.statusCode,
          status_blocked: statusBlocked,
          pattern_blocked: patternBlocked,
          ok: met,
        }],
        sub_verdict: met ? 'pass' : 'fail',
        artifacts: { http: httpResult },
      });
    }

    return results;
  }
}

module.exports = Ts07NegEngine;
