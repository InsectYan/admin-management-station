'use strict';

/** test_item_detail 表字段（生成用例允许写入的列） */
const ITEM_DETAIL_FIELDS = [
  'item_id', 'dimension_id', 'category_major_id', 'category_minor_id', 'sub_class',
  'item_name', 'detail_summary', 'expected_observation', 'test_input_example',
  'preconditions', 'test_steps', 'assertion_points', 'priority_id',
  'endpoint_path', 'http_method', 'http_status_expected',
  'scheme_primary_id', 'validation_primary_id', 'template_code',
  'station_id', 'role_scope_id', 'exec_env_id', 'env_tier_id',
  'automation_status_id', 'tags', 'notes', 'config_json', 'threshold_json',
];

/** Agent 输出别名 → 表字段 */
const FIELD_ALIASES = {
  id: 'item_id',
  case_id: 'item_id',
  caseId: 'item_id',
  title: 'item_name',
  name: 'item_name',
  summary: 'detail_summary',
  expected: 'expected_observation',
  expected_result: 'expected_observation',
  steps: 'test_steps',
  preconditions: 'preconditions',
  precondition: 'preconditions',
  assertions: 'assertion_points',
  path: 'endpoint_path',
  method: 'http_method',
  expect_status: 'http_status_expected',
  input: 'test_input_example',
  body: 'test_input_example',
  priority: 'priority_id',
};

const REQUIRED_AFTER_ALIAS = [
  'item_name',
  'detail_summary',
  'expected_observation',
  'test_steps',
];

const ARRAY_FIELDS = new Set([ 'preconditions', 'test_steps', 'assertion_points', 'tags' ]);

/** 测试平台入库时写入，Agent 无需生成 */
const PLATFORM_FILLED_FIELDS = new Set([
  'item_id', 'project_code', 'project_name', 'generation_job_id',
  'dimension_id', 'category_major_id', 'category_minor_id',
  'scheme_primary_id', 'scheme_secondary_id',
  'validation_primary_id', 'validation_secondary_id',
  'template_code', 'source_doc', 'source_section', 'scheme_mapping_source',
  'is_active',
]);

function normalizeCaseFields(tc) {
  if (!tc || typeof tc !== 'object') return {};
  const out = { ...tc };
  for (const [ alias, field ] of Object.entries(FIELD_ALIASES)) {
    if (out[field] != null && out[field] !== '') continue;
    if (out[alias] == null || out[alias] === '') continue;
    out[field] = out[alias];
  }
  if (!out.detail_summary && out.item_name) {
    out.detail_summary = out.item_name;
  }
  if (!out.assertion_points?.length && out.expected_observation) {
    out.assertion_points = [ out.expected_observation ];
  }
  return out;
}

function hasNonEmpty(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/**
 * 字段合规审计：仅校验必填项与表字段，不做业务/GDPR 语义审查。
 * @param {Record<string, unknown>} tc
 * @param {object} [_ctx]
 */
function auditItemDetailFields(tc, _ctx = {}) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeCaseFields(tc);

  if (!tc || typeof tc !== 'object') {
    return { valid: false, errors: [ '用例必须为对象' ], warnings, normalized: {} };
  }

  for (const field of REQUIRED_AFTER_ALIAS) {
    if (!hasNonEmpty(normalized[field])) {
      errors.push(`缺少必填字段 "${field}"（可用别名：${Object.entries(FIELD_ALIASES).filter(([, v]) => v === field).map(([ k ]) => k).join(', ') || '—'}）`);
    }
  }

  for (const field of ARRAY_FIELDS) {
    const val = normalized[field];
    if (val == null) continue;
    if (!Array.isArray(val)) {
      errors.push(`"${field}" 须为数组`);
    }
  }

  for (const key of Object.keys(tc)) {
    if (key === 'compliance' || key === 'status' || key.startsWith('_')) continue;
    const mapped = FIELD_ALIASES[key] || key;
    if (PLATFORM_FILLED_FIELDS.has(mapped) || PLATFORM_FILLED_FIELDS.has(key)) continue;
    if (!ITEM_DETAIL_FIELDS.includes(mapped) && !ITEM_DETAIL_FIELDS.includes(key)) {
      warnings.push(`字段 "${key}" 不在 test_item_detail 表列中，入库时将忽略`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized,
  };
}

function isApprovedCase(tc, ctx = {}) {
  return auditItemDetailFields(tc, ctx).valid;
}

module.exports = {
  ITEM_DETAIL_FIELDS,
  FIELD_ALIASES,
  REQUIRED_AFTER_ALIAS,
  PLATFORM_FILLED_FIELDS,
  normalizeCaseFields,
  auditItemDetailFields,
  isApprovedCase,
};
