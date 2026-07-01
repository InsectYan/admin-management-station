'use strict';

const { isApprovedCase, auditItemDetailFields, normalizeCaseFields } = require('./itemDetailFieldSchema');

const FIELD_MAX = 300;
const DEFAULTS = {
  dimension_id: 'C',
  category_major_id: 'C1',
  category_minor_id: 'C1_MACRO',
  automation_status_id: 'AUTO_TODO',
  station_id: 'NONE',
  role_scope_id: 'ALL',
  exec_env_id: 'EXEC_BOTH',
  env_tier_id: 'TIER_STAGING',
};

function truncate(value, max = FIELD_MAX) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function mapPriority(priority) {
  const raw = String(priority || 'medium').toLowerCase();
  if (raw.includes('p0') || raw.includes('高') || raw === 'high') return 'P0';
  if (raw.includes('p1')) return 'P1';
  if (raw.includes('低') || raw === 'low') return 'P3';
  return 'P2';
}

function toJsonArray(value) {
  if (Array.isArray(value)) return value.map(v => truncate(typeof v === 'string' ? v : JSON.stringify(v)));
  if (value == null || value === '') return [];
  return [ truncate(String(value)) ];
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [ '待补充步骤' ];
  const out = steps.map(s => {
    if (typeof s === 'string') return truncate(s);
    if (s && typeof s === 'object') return truncate(s.action || s.step || JSON.stringify(s));
    return truncate(String(s));
  }).filter(Boolean);
  return out.length ? out : [ '待补充步骤' ];
}

function buildItemId(ctx, index) {
  const scheme = String(ctx.scheme_id || 'GEN').replace(/[^A-Za-z0-9-]/g, '');
  const validation = String(ctx.validation_id || 'VS').replace(/[^A-Za-z0-9-]/g, '');
  const seq = String(index + 1).padStart(3, '0');
  const base = `${ctx.project_code}-${scheme}-${validation}-J${ctx.job_id}-${seq}`.slice(0, 64);
  return base;
}

/**
 * @param {Record<string, unknown>} tc
 * @param {object} ctx
 * @param {number} index
 */
function mapAgentCaseToItemDetail(tc, ctx, index) {
  const normalized = normalizeCaseFields(tc);
  const itemId = truncate(normalized.item_id || tc.item_id || tc.case_id || tc.caseId || buildItemId(ctx, index), 64);
  const title = truncate(normalized.item_name || tc.item_name || tc.title || tc.name || '未命名用例', 512);
  const expected = truncate(normalized.expected_observation || tc.expected_observation || tc.expected || tc.expected_result || '');
  const steps = normalizeSteps(normalized.test_steps || tc.test_steps || tc.steps);
  const preconditions = toJsonArray(tc.preconditions || tc.precondition);
  const assertions = toJsonArray(tc.assertion_points || tc.assertions || expected);

  return {
    item_id: itemId,
    project_code: ctx.project_code,
    project_name: ctx.project_name,
    generation_job_id: ctx.job_id,
    dimension_id: ctx.dimension_id || DEFAULTS.dimension_id,
    category_major_id: ctx.category_major_id || DEFAULTS.category_major_id,
    category_minor_id: ctx.category_minor_id || DEFAULTS.category_minor_id,
    template_code: ctx.template_code || null,
    sub_class: truncate(tc.sub_class || 'ai_generated', 128) || 'ai_generated',
    item_name: title,
    detail_summary: truncate(normalized.detail_summary || tc.detail_summary || title, 4096) || title,
    expected_observation: expected || null,
    test_input_example: truncate(tc.test_input_example || tc.input || tc.body || '') || null,
    preconditions,
    test_steps: steps,
    assertion_points: assertions.length ? assertions : (expected ? [ expected ] : []),
    priority_id: tc.priority_id || mapPriority(tc.priority),
    scheme_primary_id: ctx.scheme_id,
    validation_primary_id: ctx.validation_id,
    automation_status_id: tc.automation_status_id || DEFAULTS.automation_status_id,
    station_id: tc.station_id || DEFAULTS.station_id,
    role_scope_id: tc.role_scope_id || DEFAULTS.role_scope_id,
    exec_env_id: tc.exec_env_id || DEFAULTS.exec_env_id,
    env_tier_id: tc.env_tier_id || DEFAULTS.env_tier_id,
    endpoint_path: truncate(tc.endpoint_path || tc.path || '') || null,
    http_method: truncate(tc.http_method || tc.method || '', 8) || null,
    http_status_expected: tc.http_status_expected || tc.expect_status || null,
    source_doc: truncate(`ai-gen:job-${ctx.job_id}`, 128),
    source_section: truncate(ctx.validation_id || ctx.scheme_id || 'generated', 32),
    tags: Array.isArray(tc.tags) ? tc.tags : [ 'ai-generated', `job-${ctx.job_id}` ],
    notes: truncate(tc.notes || '') || null,
    scheme_mapping_source: 'ai-generation',
    is_active: true,
    config_json: tc.config_json && typeof tc.config_json === 'object' ? tc.config_json : undefined,
    threshold_json: tc.threshold_json && typeof tc.threshold_json === 'object' ? tc.threshold_json : undefined,
  };
}

module.exports = {
  mapAgentCaseToItemDetail,
  isApprovedCase,
  auditItemDetailFields,
  normalizeCaseFields,
  buildItemId,
};
