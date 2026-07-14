'use strict';

/**
 * Phase1 Agents 离线双轮+模板字段三检（N1/N2/N3）+ 本地编排冒烟
 * node backend/scripts/phase-1-agents-smoke.js
 */

const path = require('path');
const plugins = path.resolve(__dirname, '../../../../../agent-management-sub/plugins');
const { classifyIntentRule } = require(path.join(plugins, 'fitness-intent-classify-skill/lib/classifyIntent.js'));
const { resolveFixedRule } = require(path.join(plugins, 'fitness-fixed-resolve-skill/lib/resolveFixed.js'));
const { proposeConfigPatchRule } = require(path.join(plugins, 'fitness-config-structure-skill/lib/proposePatch.js'));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function tripleCheckPatch(label, patch, checks) {
  // 1 parse / keys
  assert(patch && typeof patch === 'object', `${label}: patch object`);
  assert(patch.endpoint_path || patch.http_method, `${label}: has path/method`);
  assert(patch.http_status_expected != null, `${label}: status`);
  // 2 template shape
  assert(Array.isArray(patch.assertions), `${label}: assertions array`);
  assert(typeof patch.body === 'object', `${label}: body object`);
  // 3 caller scenario asserts
  checks(patch);
  console.log(`[phase-1] triple-check ${label} ok`);
}

function run() {
  // N1 三场景
  const pos = classifyIntentRule({
    item: {
      endpoint_path: '/api/chat/turns/submit',
      http_method: 'POST',
      expected_observation: '期望 429 code=TURN_SESSION_INFLIGHT',
    },
  });
  assert(pos.intent.kind === 'business_4xx' || pos.intent.expected_status === 429, 'n1 business/429');

  const unauth = classifyIntentRule({
    item: { expected_observation: '401 AUTH_UNAUTHORIZED', endpoint_path: '/api/x' },
  });
  assert(unauth.intent.kind === 'unauth_401', 'n1 unauth');

  const omit = classifyIntentRule({
    item: {
      expected_observation: '400 缺少 message TURN_PARAMS_REQUIRED',
      endpoint_path: '/api/chat/turns/submit',
    },
  });
  assert(omit.intent.kind === 'omit_field_400', 'n1 omit');
  assert(omit.intent.omit_fields.some(f => /message/i.test(f)), 'n1 omit message');

  // pipeline local
  const catalogs = {
    env_catalog: { has_authorization: true, global_header_keys: [ 'Authorization' ] },
    api_templates_catalog: [ { id: 2, name: 'bootstrap', export_keys: [ 'session_id' ] } ],
  };

  // 正向
  const intent = classifyIntentRule({
    item: {
      endpoint_path: '/api/chat/turns/submit',
      http_method: 'POST',
      http_status_expected: 200,
      expected_observation: '200 ok',
    },
  });
  const fixed = resolveFixedRule({
    fields: intent.fields,
    intent: intent.intent,
    ...catalogs,
  });
  assert(fixed.ready, 'fixed ready');
  const struct = proposeConfigPatchRule({
    item: { endpoint_path: '/api/chat/turns/submit', http_method: 'POST' },
    intent: intent.intent,
    fields: intent.fields,
    fixed,
    api_templates_catalog: catalogs.api_templates_catalog,
    config_json: {},
  });
  tripleCheckPatch('positive', struct.config_patch, p => {
    assert(p.body.session_id === '{{session_id}}' || p.preflight_api_template_id === 2, 'session wiring');
    assert(p.headers.Authorization == null || typeof p.headers.Authorization === 'string', 'auth header ok');
  });

  // 401
  const i401 = classifyIntentRule({
    item: { endpoint_path: '/api/x', expected_observation: '401 未授权' },
  });
  const f401 = resolveFixedRule({
    fields: i401.fields,
    intent: i401.intent,
    env_catalog: catalogs.env_catalog,
  });
  const s401 = proposeConfigPatchRule({
    item: { endpoint_path: '/api/x', http_method: 'GET' },
    intent: i401.intent,
    fields: i401.fields,
    fixed: f401,
    config_json: { headers: { Authorization: 'Bearer secret' } },
  });
  tripleCheckPatch('401', s401.config_patch, p => {
    assert(!p.headers.Authorization, '401 must strip Authorization');
    assert(p.http_status_expected === 401, '401 status');
  });

  // 400 omit
  const i400 = classifyIntentRule({
    item: {
      endpoint_path: '/api/chat/turns/submit',
      expected_observation: '400 缺少 message',
    },
  });
  const f400 = resolveFixedRule({
    fields: i400.fields.filter(f => f.role === 'fixed'),
    intent: i400.intent,
    ...catalogs,
  });
  const s400 = proposeConfigPatchRule({
    item: { endpoint_path: '/api/chat/turns/submit', http_method: 'POST' },
    intent: i400.intent,
    fields: i400.fields,
    fixed: f400,
    config_json: { body: { message: 'should-drop', session_id: '{{session_id}}' } },
    api_templates_catalog: catalogs.api_templates_catalog,
  });
  tripleCheckPatch('400-omit', s400.config_patch, p => {
    assert(p.body.message == null, 'must omit message');
  });

  console.log('[phase-1-agents-smoke] all checks passed');
}

try {
  run();
} catch (err) {
  console.error('[phase-1-agents-smoke] FAILED:', err.message);
  process.exit(1);
}
