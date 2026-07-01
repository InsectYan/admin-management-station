'use strict';

const { TEMPLATE_NAMES } = require('./configTemplateRegistry');

const TEMPLATE_OUTPUT_FORMATS = {
  'TPL-DET': {
    config_json: {
      endpoint_path: 'string HTTP 路径',
      http_method: 'GET|POST|PUT|PATCH|DELETE',
      http_status_expected: 'number 期望状态码',
      test_input_example: 'string POST/PUT/PATCH 时 JSON 请求体文本',
      headers: 'object 可选，如 X-Internal-Service-Key',
      body: 'object 与 test_input_example 等价，解析后的 JSON',
    },
    threshold_json: {},
    note: 'submit 首次 202，幂等 client_turn_id 重试 200',
  },
  'TPL-BND': {
    config_json: {
      matrix: '[{ runner, path, method, expect_status, body?, headers? }]',
    },
    threshold_json: {},
  },
  'TPL-REP': {
    config_json: {
      repeat_count: 'number',
      runner: 'http|cli',
      path: 'string',
      method: 'string',
      expect_status: 'number',
      body: 'object 可选',
      headers: 'object 可选',
    },
    threshold_json: { passk_N: 'number', passk_M: 'number' },
  },
  'TPL-SET': {
    config_json: { sample_set_id: 'number 样本集 ID' },
    threshold_json: { rate_L: 'number', rate_M: 'number', rate_H: 'number' },
  },
  'TPL-CHAIN': {
    config_json: {
      steps: '[{ runner, path, method, expect_status, body?, headers?, extract? }]',
      vars: 'object 可选变量池',
    },
    threshold_json: {},
  },
  'TPL-PAIR': {
    config_json: {
      pairs: '[{ role, path, method, expect_status, body?, forbidden_patterns? }]',
    },
    threshold_json: {},
  },
  'TPL-NEG': {
    config_json: {
      cases: '[{ path, method, body?, expect_blocked, block_statuses? }]',
      block_rate_min: 'number 可选',
    },
    threshold_json: { block_rate_min: 'number' },
  },
  'TPL-OBS': {
    config_json: {
      checks: '[{ mode: http_fields|journey_list|journey_get, path?, session_id?, client_turn_id?, required_fields? }]',
    },
    threshold_json: { require_complete: 'boolean' },
  },
  'TPL-LOAD': {
    config_json: {
      vu: 'number',
      duration_sec: 'number',
      path: 'string',
      method: 'string',
      body: 'object 可选',
    },
    threshold_json: { p99_max_ms: 'number', error_rate_max: 'number' },
  },
  'TPL-MAN': {
    config_json: { rubric_id: 'string', reviewer_count: 'number' },
    threshold_json: {},
    note: '人工评审，config_json 可为空对象',
  },
};

function buildTemplateOutputFormatText(templateCode) {
  const code = templateCode || 'TPL-DET';
  const spec = TEMPLATE_OUTPUT_FORMATS[code] || TEMPLATE_OUTPUT_FORMATS['TPL-DET'];
  const name = TEMPLATE_NAMES[code] || code;
  return [
    `模板 ${code}（${name}）`,
    `config_json 形状：${JSON.stringify(spec.config_json, null, 2)}`,
    spec.threshold_json && Object.keys(spec.threshold_json).length
      ? `threshold_json 形状：${JSON.stringify(spec.threshold_json, null, 2)}`
      : 'threshold_json：{}',
    spec.note || '',
  ].filter(Boolean).join('\n');
}

function buildFitnessPrimaryContextText(target = {}) {
  const lines = [
    '## 测试平台生成目标（仅供理解范围，以下分类字段由平台入库时自动写入，Agent 勿输出）',
    `- 测试大类：${target.category_major_id || '—'} ${target.category_major_name || ''}`.trim(),
    `- 测试方案 (TS)：${target.scheme_id || '—'} ${target.scheme_name || ''}`.trim(),
    `- 主验证 (VS)：${target.validation_id || '—'} ${target.validation_name || ''}`.trim(),
    `- 配置模板：${target.template_code || '—'} ${target.template_name || ''}`.trim(),
    `- 目标条数：${target.count ?? '—'}`,
    '平台自动填入：dimension_id、category_major_id、category_minor_id、scheme_primary_id、validation_primary_id、template_code、item_id',
  ];
  if (target.dimension_id) lines.push(`- 维度：${target.dimension_id}`);
  if (target.category_minor_id) lines.push(`- 默认子类：${target.category_minor_id}`);
  return lines.join('\n');
}

module.exports = {
  TEMPLATE_OUTPUT_FORMATS,
  buildTemplateOutputFormatText,
  buildFitnessPrimaryContextText,
};
