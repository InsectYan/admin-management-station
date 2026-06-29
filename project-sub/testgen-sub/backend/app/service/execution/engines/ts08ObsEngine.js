'use strict';

const { emitProgress } = require('../../../lib/fitnessRunEvents');
const BaseTsEngine = require('./baseTsEngine');
const { runHttp } = require('../runners/httpRunner');
const { listJourneys, getJourney } = require('../runners/journeyRunner');
const { getByPath } = require('../runners/varPool');

/** @param {unknown} body @param {string[]} fields */
function checkFieldsPresent(body, fields) {
  const details = [];
  let ok = true;
  for (const field of fields || []) {
    const val = getByPath(body, field);
    const present = val !== undefined && val !== null && val !== '';
    if (!present) ok = false;
    details.push({
      type: 'field_presence',
      field,
      ok: present,
      message: present ? `${field} 存在` : `${field} 缺失`,
    });
  }
  return { ok, details };
}

class Ts08ObsEngine extends BaseTsEngine {
  constructor() {
    super('TS-08-OBS');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { item, env, run, runConfig, ctx: eggCtx } = ctx;
    const cfg = runConfig?.config_json || {};
    const checks = Array.isArray(cfg.checks) && cfg.checks.length
      ? cfg.checks
      : [ cfg ];

    if (!env?.bff_coach_url) {
      const err = new Error('执行环境未配置 bff_coach_url');
      err.status = 400;
      err.code = 'ENV_NOT_CONFIGURED';
      throw err;
    }

    const results = [];
    let passCount = 0;
    const runId = run.id;

    for (let i = 0; i < checks.length; i += 1) {
      const check = checks[i];
      const mode = check.mode || 'http_fields';
      let sub;

      if (mode === 'journey_list') {
        const httpResult = await listJourneys(eggCtx, {
          baseUrl: env.bff_coach_url,
          sessionId: check.session_id,
          limit: check.limit ?? 5,
        });
        const fields = check.required_fields || [ 'total', 'journeys' ];
        const { ok, details } = checkFieldsPresent(httpResult.body, fields);
        const statusOk = httpResult.statusCode >= 200 && httpResult.statusCode < 300;
        const pass = statusOk && ok;
        sub = {
          sub_index: i,
          input_summary: `GET /api/journeys limit=${check.limit ?? 5}`,
          output_summary: `HTTP ${httpResult.statusCode} total=${httpResult.body?.total ?? '?'}`,
          assertion_detail: details,
          sub_verdict: pass ? 'pass' : 'fail',
          artifacts: { http: httpResult, journey: httpResult.body, mode: 'journey_list' },
        };
      } else if (mode === 'journey_get') {
        const sessionId = check.session_id;
        const clientTurnId = check.client_turn_id;
        if (!sessionId || !clientTurnId) {
          const err = new Error('journey_get 需要 session_id 与 client_turn_id');
          err.status = 400;
          err.code = 'JOURNEY_PARAMS_REQUIRED';
          throw err;
        }
        const httpResult = await getJourney(eggCtx, {
          baseUrl: env.bff_coach_url,
          sessionId,
          clientTurnId,
        });
        const fields = check.required_fields || [ 'session_id', 'client_turn_id', 'journey' ];
        const { ok, details } = checkFieldsPresent(httpResult.body, fields);
        const statusOk = httpResult.statusCode === 200;
        const pass = statusOk && ok;
        sub = {
          sub_index: i,
          input_summary: `GET journey ${sessionId}/${clientTurnId}`,
          output_summary: `HTTP ${httpResult.statusCode}`,
          assertion_detail: details,
          sub_verdict: pass ? 'pass' : 'fail',
          artifacts: { http: httpResult, journey: httpResult.body, mode: 'journey_get' },
        };
      } else {
        const path = check.path || item.endpoint_path || '/health';
        const method = (check.method || 'GET').toUpperCase();
        const httpResult = await runHttp(eggCtx, {
          baseUrl: env.bff_coach_url,
          path,
          method,
          headers: {
            'X-Test-Run-Id': String(run.id),
            'X-Test-Item-Id': item.item_id,
            ...(check.headers || {}),
          },
        });
        const expectStatus = check.expect_status ?? 200;
        const statusOk = httpResult.statusCode === Number(expectStatus);
        const fields = check.required_fields || [ 'status' ];
        const { ok: fieldsOk, details: fieldDetails } = checkFieldsPresent(httpResult.body, fields);
        const pass = statusOk && fieldsOk;
        sub = {
          sub_index: i,
          input_summary: `${method} ${path} (obs fields)`,
          output_summary: `HTTP ${httpResult.statusCode}`,
          assertion_detail: [
            {
              type: 'status',
              expect: expectStatus,
              actual: httpResult.statusCode,
              ok: statusOk,
            },
            ...fieldDetails,
          ],
          sub_verdict: pass ? 'pass' : 'fail',
          artifacts: { http: httpResult, obs: httpResult.body, mode: 'http_fields' },
        };
      }

      results.push(sub);
      if (sub.sub_verdict === 'pass') passCount += 1;

      if (runId) {
        emitProgress(runId, {
          phase: 'running',
          percent: Math.min(69, Math.round(20 + ((i + 1) / checks.length) * 50)),
          pass_rate: Math.round((passCount / (i + 1)) * 1000) / 10,
          completed: i + 1,
          total: checks.length,
          run_id: runId,
        });
      }
    }

    return results;
  }
}

module.exports = Ts08ObsEngine;
