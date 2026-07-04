#!/usr/bin/env node
/**
 * 从 test_item_detail 生成 fitness-agent-test-json/{item_id}/master.json（+ sub.json）
 * 规则见 test-project/fitness-agent/测试配置JSON规则.md
 *
 * Usage:
 *   node test-project/fitness-agent/scripts/generate-test-json-configs.mjs
 *   node ... --item B4-PERSIST-001
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const testgenRoot = join(here, '../../..');
const outRoot = join(testgenRoot, '../../../fitness-agent-test-json');
const dataFile = join(testgenRoot, 'database/tables/test_item_detail/data.json');
const majorTplFile = join(testgenRoot, 'database/tables/test_category_major_template/data.json');
const tplBndFile = join(testgenRoot, 'database/tables/tpl_config_bnd/data.json');

const itemFilter = (() => {
  const i = process.argv.indexOf('--item');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const SCHEME_TO_TEMPLATE = {
  'TS-01-DET': 'TPL-DET',
  'TS-02-BND': 'TPL-BND',
  'TS-03-REP': 'TPL-REP',
  'TS-04-SET': 'TPL-SET',
  'TS-05-CHAIN': 'TPL-CHAIN',
  'TS-06-PAIR': 'TPL-PAIR',
  'TS-07-NEG': 'TPL-NEG',
  'TS-08-OBS': 'TPL-OBS',
  'TS-09-LOAD': 'TPL-LOAD',
  'TS-10-MAN': 'TPL-MAN',
};

const THRESHOLD_DEFAULTS = {
  'VS-07-RATE-L': { rate_L: 70, rate_M: 85, rate_H: 90 },
  'VS-07-RATE-M': { rate_L: 70, rate_M: 85, rate_H: 90 },
  'VS-07-RATE-H': { rate_L: 70, rate_M: 85, rate_H: 90 },
  'VS-08-PASSK': { passk_N: 5, passk_M: 4 },
  'VS-09-BLOCK-L': { block_rate_min: 70 },
  'VS-09-BLOCK-M': { block_rate_min: 85 },
  'VS-09-BLOCK-H': { block_rate_min: 95 },
  'VS-10-SLO-L': { p99_max_ms: 800, error_rate_max: 0.05 },
  'VS-10-SLO-M': { p99_max_ms: 500, error_rate_max: 0.02 },
  'VS-10-SLO-H': { p99_max_ms: 300, error_rate_max: 0.01 },
  'VS-06-COMPLETE': { require_complete: true },
};

/** 已有手工配置，生成时保留 master/sub 文件内容 */
const PRESERVE_DIRS = new Set([ 'B4-PERSIST-001' ]);

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseBody(example) {
  if (example == null) return undefined;
  if (typeof example === 'object') return example;
  const raw = String(example).trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function roleFromScope(roleScopeId) {
  const m = { COACH: 'coach', MEMBER: 'member', MANAGER: 'manager', ALL: 'coach' };
  return m[roleScopeId] || 'coach';
}

function apiPrefix(role) {
  if (role === 'member') return '/api/member/chat/turns';
  if (role === 'manager') return '/api/admin/chat/turns';
  return '/api/chat/turns';
}

function cliRow(item, name) {
  return {
    name: name || item.detail_summary || item.item_id,
    runner: 'cli',
    command: item.automation_command,
  };
}

function httpRow(item, overrides = {}) {
  return {
    name: overrides.name || item.detail_summary || item.item_id,
    runner: 'http',
    method: overrides.method || item.http_method || 'GET',
    path: overrides.path || item.endpoint_path || '/health',
    expect_status: overrides.expect_status ?? item.http_status_expected ?? 200,
    ...(overrides.body ? { body: overrides.body } : {}),
    ...(parseBody(item.test_input_example) ? { body: parseBody(item.test_input_example) } : {}),
  };
}

function buildDetConfig(item) {
  if (item.automation_command && !item.endpoint_path) {
    return {
      _execution: 'cli',
      _note: 'TS-01-DET 执行时读取 test_item_detail.automation_command，无需 HTTP path',
      automation_command: item.automation_command,
    };
  }
  const cfg = {
    endpoint_path: item.endpoint_path || '/health',
    http_method: item.http_method || 'GET',
    http_status_expected: item.http_status_expected ?? 200,
  };
  const body = parseBody(item.test_input_example);
  if (body) cfg.body = body;
  if (item.automation_command) {
    cfg.runner = 'cli';
    cfg.command = item.automation_command;
  }
  return cfg;
}

function buildBndConfig(item, tplBndMap) {
  const seeded = tplBndMap.get(item.item_id);
  if (seeded?.config_json?.matrix?.length) {
    return seeded.config_json;
  }
  if (item.automation_command) {
    const rows = (item.test_steps || []).length > 1
      ? item.test_steps.map((step, idx) => ({
        name: String(step).slice(0, 80),
        runner: 'cli',
        command: item.automation_command,
        ...(idx === 0 ? {} : { _note: '同命令覆盖多断言场景，可按业务拆分 filter' }),
      }))
      : [ cliRow(item) ];
    return { matrix: rows };
  }
  if (item.endpoint_path) {
    return { matrix: [ httpRow(item) ] };
  }
  return {
    matrix: [ {
      name: item.detail_summary || item.item_id,
      runner: 'http',
      method: 'GET',
      path: '/health',
      expect_status: 200,
    } ],
    _note: '待补 automation_command 或 endpoint_path',
  };
}

function buildRepConfig(item) {
  const cfg = {
    repeat_count: 5,
    runner: item.automation_command ? 'cli' : 'http',
    path: item.endpoint_path || '/health',
    method: item.http_method || 'GET',
    expect_status: item.http_status_expected ?? 200,
  };
  if (item.automation_command) cfg.command = item.automation_command;
  const body = parseBody(item.test_input_example);
  if (body) cfg.body = body;
  return cfg;
}

function buildSetConfig(item) {
  return {
    sample_set_id: null,
    _note: `绑定样本集后填入 sample_set_id；${item.detail_summary || ''}`.trim(),
  };
}

function buildChainConfig(item) {
  const role = roleFromScope(item.role_scope_id);
  const prefix = apiPrefix(role);
  const vars = { coach_id: 1, user_id: 10003 };
  const steps = [];

  if (item.automation_command) {
    steps.push({
      name: '0 · CLI 站级自测',
      runner: 'cli',
      command: item.automation_command,
    });
  }

  if (item.endpoint_path || role === 'coach') {
    steps.push({
      name: '1 · create session',
      runner: 'http',
      method: 'POST',
      path: '/api/sessions',
      body: { coach_id: 1, user_id: 10003 },
      expect_status: 200,
      extract: { session_id: '$.session_id' },
    });
    steps.push({
      name: '2 · submit turn',
      runner: 'http',
      method: 'POST',
      path: `${prefix}/submit`,
      body: {
        session_id: '{{session_id}}',
        coach_id: 1,
        user_id: 10003,
        message: item.detail_summary || '测试消息',
        client_turn_id: '{{uuid}}',
      },
      expect_status: item.http_status_expected ?? 202,
      extract: { turn_id: '$.turn_id' },
    });
    if (item.endpoint_path && item.endpoint_path !== `${prefix}/submit`) {
      steps.push(httpRow(item, { name: '3 · 断言接口' }));
    } else {
      steps.push({
        name: '3 · poll turn',
        runner: 'http',
        method: 'GET',
        path: `${prefix}/{{turn_id}}`,
        expect_status: 200,
      });
    }
  } else if (item.endpoint_path) {
    steps.push(httpRow(item));
  }

  if (!steps.length) {
    steps.push({
      name: item.detail_summary || item.item_id,
      runner: 'http',
      method: 'GET',
      path: '/health',
      expect_status: 200,
    });
  }

  return { vars, steps };
}

function buildPairConfig(item) {
  const path = item.endpoint_path || '/health';
  const method = item.http_method || 'GET';
  const expect = item.http_status_expected ?? 200;
  const roles = item.role_scope_id === 'ALL'
    ? [ 'coach', 'member', 'manager' ]
    : [ roleFromScope(item.role_scope_id) ];
  return {
    pairs: roles.map(role => ({
      role,
      path: role === 'member' ? path.replace('/api/chat/', '/api/member/chat/').replace('/api/', '/api/member/') : path,
      method,
      expect_status: expect,
      forbidden_patterns: item.validation_primary_id === 'VS-03-ZERO' ? [ 'plan_form', 'training_plan' ] : [],
    })),
  };
}

function buildNegConfig(item) {
  const path = item.endpoint_path || '/api/__adv__/probe';
  return {
    cases: [ {
      path,
      method: item.http_method || 'GET',
      expect_blocked: true,
      block_statuses: [ 400, 403, 404, 405, 422, 429, 500 ],
    } ],
    block_rate_min: THRESHOLD_DEFAULTS[item.validation_primary_id]?.block_rate_min ?? 95,
  };
}

function buildObsConfig(item) {
  const checks = [];
  const points = item.assertion_points || [];
  const text = [ item.detail_summary, item.expected_observation, ...points ].join(' ');

  if (/journey|S1|S6|站点/i.test(text)) {
    checks.push({ mode: 'journey_list', limit: 5 });
  }
  if (/session_id|client_turn_id|journey_get/i.test(text)) {
    checks.push({
      mode: 'journey_get',
      session_id: '',
      client_turn_id: '',
    });
  }
  if (!checks.length || /health|status|runtime|字段/i.test(text)) {
    checks.unshift({
      mode: 'http_fields',
      path: item.endpoint_path || '/health',
      method: item.http_method || 'GET',
      expect_status: item.http_status_expected ?? 200,
      required_fields: points.length
        ? points.map(p => String(p).split(/[、,]/)[0].trim()).filter(Boolean)
        : [ 'status', 'runtime' ],
    });
  }

  const cfg = { checks };
  if (item.validation_primary_id === 'VS-06-COMPLETE') {
    cfg._threshold = { require_complete: true };
  }
  return cfg;
}

function buildLoadConfig(item) {
  return {
    vu: 10,
    duration_sec: 30,
    path: item.endpoint_path || '/api/chat/turns/submit',
    method: item.http_method || 'POST',
    body: parseBody(item.test_input_example) || {
      session_id: '{{session_id}}',
      coach_id: 1,
      message: '压测探针',
      client_turn_id: '{{uuid}}',
    },
  };
}

function buildManConfig(item) {
  return {
    rubric_id: item.item_id.toLowerCase().replace(/-/g, '_'),
    reviewer_count: 3,
    _note: item.expected_observation || '人工评审',
  };
}

function buildConfigForScheme(schemeId, item, tplBndMap) {
  switch (schemeId) {
    case 'TS-01-DET': return buildDetConfig(item);
    case 'TS-02-BND': return buildBndConfig(item, tplBndMap);
    case 'TS-03-REP': return buildRepConfig(item);
    case 'TS-04-SET': return buildSetConfig(item);
    case 'TS-05-CHAIN': return buildChainConfig(item);
    case 'TS-06-PAIR': return buildPairConfig(item);
    case 'TS-07-NEG': return buildNegConfig(item);
    case 'TS-08-OBS': return buildObsConfig(item);
    case 'TS-09-LOAD': return buildLoadConfig(item);
    case 'TS-10-MAN': return buildManConfig(item);
    default: return buildDetConfig(item);
  }
}

function buildThreshold(item, schemeId) {
  const primary = THRESHOLD_DEFAULTS[item.validation_primary_id] || {};
  const secondary = item.validation_secondary_id
    ? (THRESHOLD_DEFAULTS[item.validation_secondary_id] || {})
    : {};
  const merged = { ...primary, ...secondary };
  if (schemeId === 'TS-03-REP' && !merged.passk_N) {
    merged.passk_N = 5;
    merged.passk_M = 4;
  }
  return Object.keys(merged).length ? merged : undefined;
}

function shouldEmit(item) {
  if (item.is_active === false) return false;
  if (itemFilter && item.item_id !== itemFilter) return false;
  if (item.scheme_primary_id === 'TS-10-MAN') return true;
  return true;
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  const items = readJson(dataFile, []);
  const tplBnd = readJson(tplBndFile, []);
  const tplBndMap = new Map(tplBnd.map(r => [ r.item_id, r ]));

  const manifest = {
    generated_at: new Date().toISOString(),
    source: 'testgen-sub/database/tables/test_item_detail/data.json',
    output_root: 'fitness-agent-test-json',
    rules: 'test-project/fitness-agent/测试配置JSON规则.md',
    items: [],
  };

  let written = 0;
  let skipped = 0;

  for (const item of items) {
    if (!shouldEmit(item)) continue;

    const dir = join(outRoot, item.item_id);
    const masterPath = join(dir, 'master.json');
    const subPath = join(dir, 'sub.json');
    const thresholdPath = join(dir, 'threshold.json');

    if (PRESERVE_DIRS.has(item.item_id) && existsSync(masterPath)) {
      manifest.items.push({
        item_id: item.item_id,
        scheme_primary_id: item.scheme_primary_id,
        scheme_secondary_id: item.scheme_secondary_id,
        template: SCHEME_TO_TEMPLATE[item.scheme_primary_id],
        status: 'preserved',
        files: [ 'master.json', ...(existsSync(subPath) ? [ 'sub.json' ] : []) ],
      });
      skipped += 1;
      continue;
    }

    const master = buildConfigForScheme(item.scheme_primary_id, item, tplBndMap);
    writeJson(masterPath, master);
    written += 1;

    const files = [ 'master.json' ];

    const threshold = buildThreshold(item, item.scheme_primary_id);
    if (threshold) {
      writeJson(thresholdPath, threshold);
      files.push('threshold.json');
    }

    if (item.scheme_secondary_id) {
      const sub = buildConfigForScheme(item.scheme_secondary_id, item, tplBndMap);
      writeJson(subPath, sub);
      files.push('sub.json');
      const subThreshold = buildThreshold(item, item.scheme_secondary_id);
      if (subThreshold) writeJson(join(dir, 'threshold-sub.json'), subThreshold);
    }

    manifest.items.push({
      item_id: item.item_id,
      item_name: item.item_name,
      scheme_primary_id: item.scheme_primary_id,
      scheme_secondary_id: item.scheme_secondary_id,
      template: SCHEME_TO_TEMPLATE[item.scheme_primary_id],
      sub_template: item.scheme_secondary_id ? SCHEME_TO_TEMPLATE[item.scheme_secondary_id] : null,
      automation_command: item.automation_command || null,
      endpoint_path: item.endpoint_path || null,
      status: item.automation_command ? 'automation' : 'template-default',
      files,
    });
  }

  writeJson(join(outRoot, '_manifest.json'), manifest);

  console.log(`fitness-agent-test-json: written=${written}, preserved=${skipped}, total=${manifest.items.length}`);
  console.log(`manifest: ${join(outRoot, '_manifest.json')}`);
}

main();
