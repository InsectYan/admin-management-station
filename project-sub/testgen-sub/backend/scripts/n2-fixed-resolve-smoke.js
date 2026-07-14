'use strict';

/**
 * N2 fitness-fixed-resolve 离线三检 + 规则 resolve
 * node backend/scripts/n2-fixed-resolve-smoke.js
 */

const path = require('path');
const { resolveFixedRule } = require(path.join(
  __dirname,
  '../../../../../agent-management-sub/plugins/fitness-fixed-resolve-skill/lib/resolveFixed.js',
));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runOnce(label, params, check) {
  const out = resolveFixedRule(params);
  check(out);
  console.log(`[n2-smoke] ${label} ok`);
  return out;
}

function run() {
  // 三检 1：可解析 JSON 形状
  runOnce('shape-positive', {
    intent: { kind: 'positive', needs_auth: true },
    fields: [
      { name: 'Authorization', location: 'headers', role: 'fixed', required: true },
      { name: 'preflight_api_template_id', role: 'fixed', export_var: 'session_id', required: true },
    ],
    env_catalog: { global_header_keys: [ 'Authorization' ], has_authorization: true },
    api_templates_catalog: [ { id: 12, name: 'chat-bootstrap', export_keys: [ 'session_id' ] } ],
  }, out => {
    assert(out.ready === true, 'should be ready');
    assert(out.bindings.preflight_api_template_id === 12, 'template binding');
    assert(Array.isArray(out.resolved_fixed) && out.resolved_fixed.length >= 1, 'resolved');
  });

  // 三检 2：禁止虚构 template_id
  runOnce('no-hallucinate-template', {
    intent: { kind: 'positive' },
    fields: [
      { name: 'preflight_api_template_id', role: 'fixed', export_var: 'session_id', required: true },
    ],
    env_catalog: {},
    api_templates_catalog: [],
  }, out => {
    assert(out.ready === false, 'must block');
    assert(out.missing_fixed.some(m => m.field === 'preflight_api_template_id'), 'missing template');
    assert(!out.bindings.preflight_api_template_id, 'no invented id');
  });

  // 三检 3：401 不解析鉴权
  runOnce('unauth-skip', {
    intent: { kind: 'unauth_401', corrupt_headers: [ 'Authorization' ] },
    fields: [
      { name: 'Authorization', location: 'headers', role: 'fixed', required: true },
    ],
    env_catalog: { has_authorization: true, global_header_keys: [ 'Authorization' ] },
  }, out => {
    assert(out.skip_resolve_fields.some(f => /Authorization/i.test(f)), 'skip auth');
    assert(!out.resolved_fixed.some(r => /Authorization/i.test(r.field)), 'must not resolve auth');
  });

  console.log('[n2-smoke] all checks passed (3 loops)');
}

try {
  run();
} catch (err) {
  console.error('[n2-smoke] FAILED:', err.message);
  process.exit(1);
}
