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
