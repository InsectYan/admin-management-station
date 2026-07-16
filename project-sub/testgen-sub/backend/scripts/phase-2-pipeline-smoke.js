'use strict';

/**
 * Phase2/3：本地 Autofill 编排链（无 Egg，规则降级路径）
 * node backend/scripts/phase-2-pipeline-smoke.js
 */

const path = require('path');
const plugins = path.resolve(__dirname, '../../../../../agent-management-sub/plugins');
const { classifyIntentRule } = require(path.join(plugins, 'fitness-intent-classify-skill/lib/classifyIntent.js'));
const { resolveFixedRule } = require(path.join(plugins, 'fitness-fixed-resolve-skill/lib/resolveFixed.js'));
const { proposeConfigPatchRule } = require(path.join(plugins, 'fitness-config-structure-skill/lib/proposePatch.js'));
const {
  assessConfigCompleteness,
  buildAutofillBlockedEnvelope,
} = require('../app/lib/configCompletenessGate');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runPipelineLocal(item, config_json, catalogs) {
  const assessment = assessConfigCompleteness('TS-01-DET', item, { config_json }, {
    env_catalog: catalogs.env_catalog,
  });
  const intentOut = classifyIntentRule({ item, config_json });
  const fixedOut = resolveFixedRule({
    fields: intentOut.fields,
    intent: intentOut.intent,
    env_catalog: catalogs.env_catalog,
    api_templates_catalog: catalogs.api_templates_catalog,
  });
  if (fixedOut.missing_fixed.length) {
    return {
      blocked: true,
      envelope: buildAutofillBlockedEnvelope({
        item,
        env: { id: 9, name: 'demo', project_code: item.project_code },
        assessment: {
          ...assessment,
          gaps: fixedOut.missing_fixed.map(m => ({
            field: m.field,
            role: 'fixed',
            reason: m.detail,
          })),
        },
        intent: intentOut.intent,
        pipeline_step: 'resolve',
      }),
    };
  }
  const structureOut = proposeConfigPatchRule({
    item,
    config_json,
    intent: intentOut.intent,
    fields: intentOut.fields,
    fixed: fixedOut,
    gaps: assessment.gaps,
    api_templates_catalog: catalogs.api_templates_catalog,
  });
  return {
    blocked: false,
    intent: intentOut.intent,
    patch: structureOut.config_patch,
    assessment,
  };
}

function run() {
  const catalogsOk = {
    env_catalog: {
      has_bff_url: true,
      has_authorization: true,
      global_header_keys: [ 'Authorization' ],
    },
    api_templates_catalog: [ { id: 2, name: 'bootstrap-chat', export_keys: [ 'session_id' ] } ],
  };

  // J1-008 族：空 config + 正向
  const r1 = runPipelineLocal(
    {
      item_id: 'demo-TS-01-DET-J1-008',
      project_code: 'demo-proj',
      endpoint_path: '/api/chat/turns/submit',
      http_method: 'POST',
      http_status_expected: 200,
      expected_observation: '200',
    },
    {},
    catalogsOk,
  );
  assert(!r1.blocked, 'empty config should autofill');
  assert(r1.patch.endpoint_path.includes('/submit'), 'path filled');
  assert(r1.patch.body.session_id === '{{session_id}}' || r1.patch.preflight_api_template_id === 2, 'session');

  // 无模板 → missing
  const r2 = runPipelineLocal(
    {
      item_id: 'x',
      project_code: 'demo-proj',
      endpoint_path: '/api/chat/turns/submit',
      http_method: 'POST',
      expected_observation: '200',
    },
    {},
    { env_catalog: catalogsOk.env_catalog, api_templates_catalog: [] },
  );
  assert(r2.blocked, 'no template blocks');
  assert(r2.envelope.code === 'CONFIG_AUTOFILL_BLOCKED', 'envelope code');
  assert(r2.envelope.project_code === 'demo-proj', 'project in envelope');
  assert(r2.envelope.missing_fixed.some(m => /preflight/i.test(m.field)), 'missing preflight');

  // 401
  const r3 = runPipelineLocal(
    {
      item_id: 'x',
      project_code: 'demo-proj',
      endpoint_path: '/api/x',
      http_method: 'GET',
      expected_observation: '401 AUTH_UNAUTHORIZED',
    },
    { headers: { Authorization: 'Bearer keep-me' } },
    { env_catalog: catalogsOk.env_catalog, api_templates_catalog: [] },
  );
  assert(!r3.blocked, '401 should not need template if no session');
  assert(!r3.patch.headers.Authorization, '401 strips auth');

  // 请求头不在执行前闸门阻断（即使无 Authorization）
  const rAuthSkip = runPipelineLocal(
    {
      item_id: 'x',
      project_code: 'demo-proj',
      endpoint_path: '/api/llm/profiles',
      http_method: 'GET',
      http_status_expected: 200,
      expected_observation: '200',
    },
    {},
    {
      env_catalog: { has_bff_url: true, has_authorization: false, global_header_keys: [] },
      api_templates_catalog: [],
    },
  );
  assert(!rAuthSkip.blocked, 'headers must not block launch gate');
  if (rAuthSkip.envelope) {
    assert(!(rAuthSkip.envelope.missing_fixed || []).some(m => /Authorization/i.test(m.field)), 'no auth missing');
  }
  // 400 omit
  const r4 = runPipelineLocal(
    {
      item_id: 'x',
      project_code: 'demo-proj',
      endpoint_path: '/api/chat/turns/submit',
      expected_observation: '400 缺少 message',
    },
    {},
    catalogsOk,
  );
  assert(!r4.blocked || r4.patch, '400 path');
  if (!r4.blocked) {
    assert(r4.patch.body.message == null, 'omit message');
  }

  // ENV 回归：envelope 不得落到 fitness
  assert(r2.envelope.env_name !== 'fitness', 'env name');
  assert(r2.envelope.project_code !== 'fitness-agent', 'not fitness project');

  console.log('[phase-2-pipeline-smoke] all checks passed');
}

try {
  run();
} catch (err) {
  console.error('[phase-2-pipeline-smoke] FAILED:', err.message);
  process.exit(1);
}
