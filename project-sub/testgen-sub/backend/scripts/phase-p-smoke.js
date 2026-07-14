'use strict';

/**
 * Phase P 离线冒烟：ENV 项目隔离 + DET-03 启动前校验（无需 DB / Agent）
 * 运行：node backend/scripts/phase-p-smoke.js
 */

const path = require('path');
const {
  requireProjectCode,
  assertEnvBelongsToProject,
  pickDefaultEnvForProject,
} = require('../app/lib/envProjectScope');
const { validateDetLaunchPreconditions } = require('../app/lib/detLaunchGuard');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function expectThrow(fn, code) {
  let caught = null;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  assert(caught, `expected throw ${code}`);
  assert(caught.code === code, `expected code ${code} got ${caught.code}: ${caught.message}`);
}

function run() {
  expectThrow(() => requireProjectCode(''), 'PROJECT_CODE_REQUIRED');
  expectThrow(() => requireProjectCode(null), 'PROJECT_CODE_REQUIRED');
  assert(requireProjectCode(' demo-proj ') === 'demo-proj', 'trim project code');

  const fitnessEnv = { id: 1, name: 'local-docker', project_code: 'fitness-agent', is_default: true };
  const demoEnv = { id: 2, name: 'local', project_code: 'demo-proj', is_default: true, bff_coach_url: 'http://p2' };

  expectThrow(() => assertEnvBelongsToProject(fitnessEnv, 'demo-proj'), 'ENV_PROJECT_MISMATCH');
  assert(assertEnvBelongsToProject(demoEnv, 'demo-proj') === demoEnv, 'same project ok');
  expectThrow(() => assertEnvBelongsToProject(null, 'demo-proj'), 'ENV_NOT_CONFIGURED');

  const picked = pickDefaultEnvForProject([ fitnessEnv, demoEnv ], 'demo-proj');
  assert(picked && picked.id === 2, 'pickDefault must stay in demo-proj, not fitness');
  assert(pickDefaultEnvForProject([ fitnessEnv ], 'demo-proj') === null, 'no env for empty project');

  expectThrow(
    () => validateDetLaunchPreconditions(
      { endpoint_path: '/api/chat/turns/{{turn_id}}' },
      { config_json: {} },
    ),
    'DET_PREFLIGHT_REQUIRED',
  );

  expectThrow(
    () => validateDetLaunchPreconditions(
      { endpoint_path: '/api/chat/turns/{{turn_id}}' },
      {
        config_json: {
          preflight_api_template_id: 12,
          preflight_include_main_request: false,
        },
      },
    ),
    'DET_POLL_MAIN_REQUEST_REQUIRED',
  );

  const ok = validateDetLaunchPreconditions(
    { endpoint_path: '/api/chat/turns/{{turn_id}}' },
    {
      config_json: {
        preflight_api_template_id: 12,
        preflight_include_main_request: true,
      },
    },
  );
  assert(ok.ok === true, 'poll with main request should pass');

  const warn = validateDetLaunchPreconditions(
    { endpoint_path: '/api/x/{{openid}}' },
    { config_json: {} },
  );
  assert(warn.warnings.length >= 1, 'placeholder without preflight should warn extract note');
  assert(/extract/.test(warn.warnings[0]), 'warning must mention extract runtime note');

  // 跨项目列表：fitness 默认不得被 demo 选中
  const multi = pickDefaultEnvForProject(
    [
      { id: 9, project_code: 'fitness-agent', is_default: true },
      { id: 10, project_code: 'other', is_default: true },
      { id: 11, project_code: 'demo-proj', is_default: false },
      { id: 12, project_code: 'demo-proj', is_default: true },
    ],
    'demo-proj',
  );
  assert(multi && multi.id === 12, 'prefer is_default within project');

  console.log('[phase-p-smoke] all checks passed');
}

try {
  run();
} catch (err) {
  console.error('[phase-p-smoke] FAILED:', err.message);
  process.exit(1);
}
