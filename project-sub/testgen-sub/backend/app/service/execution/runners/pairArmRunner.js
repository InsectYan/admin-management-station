'use strict';

const { runHttp } = require('./httpRunner');
const { scanForbidden } = require('./forbiddenScan');

/** @param {object|null} env @param {string} role */
function resolveRoleBaseUrl(env, role) {
  const key = String(role || 'coach').toLowerCase();
  const map = {
    coach: env?.bff_coach_url,
    member: env?.bff_member_url,
    manager: env?.bff_manager_url,
  };
  return map[key] || env?.bff_coach_url;
}

/**
 * @param {import('../runOrchestrator').ExecutionContext} execCtx
 * @param {object} arm
 * @param {number} subIndex
 */
async function executePairArm(execCtx, arm, subIndex) {
  const { item, env, run, runConfig, ctx: eggCtx } = execCtx;
  const configJson = runConfig?.config_json || {};
  const baseUrl = resolveRoleBaseUrl(env, arm.role || 'coach');

  if (!baseUrl) {
    const err = new Error(`执行环境未配置 ${arm.role || 'coach'} 端 BFF URL`);
    err.status = 400;
    err.code = 'ENV_NOT_CONFIGURED';
    throw err;
  }

  const path = arm.path || arm.endpoint_path || '/health';
  const method = (arm.method || 'GET').toUpperCase();
  const expectStatus = arm.expect_status ?? 200;
  const headers = {
    'X-Test-Run-Id': String(run.id),
    'X-Test-Item-Id': item.item_id,
    'X-Test-Role': String(arm.role || 'coach'),
    ...(configJson.headers || {}),
    ...(arm.headers || {}),
  };

  const httpResult = await runHttp(eggCtx, {
    baseUrl,
    path,
    method,
    headers,
    body: arm.body,
  });

  const statusOk = httpResult.statusCode === Number(expectStatus);
  const patterns = arm.forbidden_patterns ?? configJson.forbidden_patterns ?? [];
  const violation = scanForbidden(httpResult.body, patterns);
  const pass = statusOk && !violation;

  return {
    sub_index: subIndex,
    input_summary: `${arm.role || 'coach'} ${method} ${path}`,
    output_summary: violation
      ? `违规命中: ${violation}`
      : `HTTP ${httpResult.statusCode} (${httpResult.responseTimeMs}ms)`,
    assertion_detail: [
      {
        type: 'status',
        role: arm.role || 'coach',
        expect: expectStatus,
        actual: httpResult.statusCode,
        ok: statusOk,
      },
      {
        type: 'forbidden_scan',
        role: arm.role || 'coach',
        patterns,
        violation,
        ok: !violation,
      },
    ],
    sub_verdict: pass ? 'pass' : 'fail',
    artifacts: { http: httpResult, role: arm.role || 'coach' },
  };
}

module.exports = { executePairArm, resolveRoleBaseUrl };
