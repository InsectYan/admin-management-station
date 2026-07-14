'use strict';

/**
 * Phase 0 离线冒烟：齐全度门禁 + 异常信封
 * 运行：node backend/scripts/phase-0-smoke.js
 */

const {
  assessDetCompleteness,
  buildAutofillBlockedEnvelope,
} = require('../app/lib/configCompletenessGate');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  const incomplete = assessDetCompleteness(
    { item_id: 'demo-TS-01-DET-x', project_code: 'demo-proj', endpoint_path: null },
    { config_json: {} },
  );
  assert(incomplete.complete === false, 'empty det should be incomplete');
  assert(incomplete.gaps.some(g => g.field === 'endpoint_path'), 'need path gap');
  assert(incomplete.gaps.some(g => g.field === 'http_status_expected'), 'need status gap');

  const env = { id: 2, name: 'p2-local', project_code: 'demo-proj', bff_coach_url: 'http://p2' };
  const envelope = buildAutofillBlockedEnvelope({
    item: { item_id: 'demo-TS-01-DET-x', project_code: 'demo-proj' },
    env,
    assessment: incomplete,
  });
  assert(envelope.code === 'CONFIG_AUTOFILL_BLOCKED', 'code');
  assert(envelope.project_code === 'demo-proj', 'project_code in envelope');
  assert(envelope.env_id === 2 && envelope.env_name === 'p2-local', 'env in envelope');
  assert(Array.isArray(envelope.missing_fixed) && envelope.missing_fixed.length >= 1, 'missing_fixed');
  assert(envelope.pipeline_step === 'gate', 'pipeline_step');
  assert(envelope.config_snapshot, 'config_snapshot');

  const ok = assessDetCompleteness(
    {
      item_id: 'x',
      endpoint_path: '/health',
      http_method: 'GET',
      http_status_expected: 200,
    },
    { config_json: { endpoint_path: '/health', http_method: 'GET', http_status_expected: 200 } },
    { env_catalog: { has_bff_url: true } },
  );
  assert(ok.complete === true, 'full det should be complete');

  // 用例表已有 path/method/status，但 ft_run_config 为空 → 必须判定不齐（触发自动补齐）
  const itemOnly = assessDetCompleteness(
    {
      item_id: 'fitness-agent-TS-01-DET-VS-01-EXACT-J1-008',
      project_code: 'fitness-agent',
      endpoint_path: '/api/chat/turns/submit',
      http_method: 'POST',
      http_status_expected: 401,
    },
    null,
    { env_catalog: { has_bff_url: true } },
  );
  assert(itemOnly.complete === false, 'item metadata alone must NOT skip autofill');
  assert(itemOnly.gaps.some(g => g.field === 'endpoint_path' && g.role === 'structure'), 'path from item is structure');
  assert(itemOnly.gaps.some(g => g.field === 'body'), 'POST needs body structure gap');
  assert(!itemOnly.gaps.some(g => g.field === 'http_method' && g.role === 'fixed'), 'POST on item is not fixed-missing');

  const blockedEnv = buildAutofillBlockedEnvelope({
    item: { item_id: 'x', project_code: 'demo' },
    env: { id: 1, name: 'e1' },
    assessment: {
      gaps: [{ field: 'preflight_api_template_id', role: 'fixed', reason: '无匹配模板' }],
      config_snapshot: {},
      warnings: [],
    },
  });
  assert(blockedEnv.missing_fixed[0].label.includes('前置'), 'chinese label');
  assert(/前置接口模板/.test(blockedEnv.message), 'message in chinese');

  const pollOk = assessDetCompleteness(
    { endpoint_path: '/api/chat/turns/{{turn_id}}', http_method: 'GET', http_status_expected: 200 },
    {
      config_json: {
        endpoint_path: '/api/chat/turns/{{turn_id}}',
        http_method: 'GET',
        http_status_expected: 200,
        preflight_api_template_id: 1,
        preflight_include_main_request: true,
      },
    },
    { env_catalog: { has_bff_url: true } },
  );
  assert(pollOk.complete === true, 'poll with preflight+main should be complete');

  const pollGap = assessDetCompleteness(
    { endpoint_path: '/api/chat/turns/{{turn_id}}', http_method: 'GET', http_status_expected: 200 },
    {
      config_json: {
        endpoint_path: '/api/chat/turns/{{turn_id}}',
        http_method: 'GET',
        http_status_expected: 200,
        preflight_api_template_id: 1,
        preflight_include_main_request: false,
      },
    },
  );
  assert(pollGap.complete === false, 'poll without main request incomplete');
  assert(pollGap.gaps.some(g => g.field === 'preflight_include_main_request'), 'poll gate');

  console.log('[phase-0-smoke] all checks passed');
}

try {
  run();
} catch (err) {
  console.error('[phase-0-smoke] FAILED:', err.message);
  process.exit(1);
}
