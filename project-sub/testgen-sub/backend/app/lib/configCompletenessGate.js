'use strict';

const { EXTRACT_RUNTIME_NOTE } = require('./extractRuntimeNote');
const { collectPlaceholders } = require('../service/execution/runners/detPreflightRunner');

/**
 * @param {object} item
 * @param {object|null} runConfig
 * @param {object} [opts]
 * @returns {{ complete: boolean, template_code: string, scheme_id: string, gaps: object[], config_snapshot: object, warnings: string[] }}
 */
function assessDetCompleteness(item, runConfig, opts = {}) {
  const configJson = { ...(runConfig?.config_json || {}) };
  const schemeId = opts.scheme_id || item?.scheme_primary_id || 'TS-01-DET';
  const gaps = [];
  const warnings = [];

  const snapshot = {
    endpoint_path: configJson.endpoint_path || item?.endpoint_path || null,
    http_method: configJson.http_method || item?.http_method || null,
    http_status_expected: configJson.http_status_expected ?? item?.http_status_expected ?? null,
    headers: configJson.headers || {},
    body: configJson.body || null,
    preflight_api_template_id: configJson.preflight_api_template_id || null,
    preflight_include_main_request: configJson.preflight_include_main_request,
    assertions: configJson.assertions || [],
  };

  if (item?.automation_command || configJson.execution_mode === 'cli') {
    return {
      complete: true,
      template_code: 'TPL-DET',
      scheme_id: schemeId,
      gaps: [],
      config_snapshot: snapshot,
      warnings: [],
    };
  }

  if (!snapshot.endpoint_path) {
    gaps.push({
      field: 'endpoint_path',
      role: 'fixed',
      reason: '缺少主请求 Path',
    });
  }
  if (!snapshot.http_method) {
    gaps.push({
      field: 'http_method',
      role: 'fixed',
      reason: '缺少 HTTP 方法',
    });
  }
  if (snapshot.http_status_expected == null || snapshot.http_status_expected === '') {
    gaps.push({
      field: 'http_status_expected',
      role: 'fixed',
      reason: '缺少期望状态码',
    });
  }

  const pathPlaceholders = collectPlaceholders(snapshot.endpoint_path || '');
  for (const key of pathPlaceholders) {
    const hasPreflight = Boolean(snapshot.preflight_api_template_id);
    if ((key === 'turn_id' || key === 'session_id') && !hasPreflight) {
      gaps.push({
        field: 'preflight_api_template_id',
        role: 'fixed',
        reason: `Path 含 {{${key}}}，必须关联前置接口模板`,
        expected_source: 'ft_api_template',
      });
    } else if (!hasPreflight) {
      gaps.push({
        field: `path.{{${key}}}`,
        role: 'variable',
        reason: `Path 含 {{${key}}}，须由环境 fixed_params / 项目 manual 变量提供（extract 不生效）`,
      });
    } else {
      warnings.push(`Path 依赖 {{${key}}}，将由前置模板 / 变量池在执行期解析`);
    }
  }

  if (pathPlaceholders.includes('turn_id') && snapshot.preflight_api_template_id
    && snapshot.preflight_include_main_request === false) {
    gaps.push({
      field: 'preflight_include_main_request',
      role: 'fixed',
      reason: 'poll 需要勾选「执行模板主请求」以导出 turn_id',
    });
  }

  if (opts.env_catalog && !opts.env_catalog.has_bff_url) {
    gaps.push({
      field: 'env.bff_coach_url',
      role: 'fixed',
      reason: '当前项目执行环境未配置 bff_coach_url',
    });
  }

  warnings.push(EXTRACT_RUNTIME_NOTE);

  const blocking = gaps.filter(g => g.role === 'fixed');
  return {
    complete: blocking.length === 0,
    template_code: 'TPL-DET',
    scheme_id: schemeId,
    gaps,
    config_snapshot: snapshot,
    warnings,
  };
}

/**
 * @param {string} schemeId
 * @param {object} item
 * @param {object|null} runConfig
 * @param {object} [opts]
 */
function assessConfigCompleteness(schemeId, item, runConfig, opts = {}) {
  if (schemeId === 'TS-01-DET') {
    return assessDetCompleteness(item, runConfig, { ...opts, scheme_id: schemeId });
  }
  return {
    complete: true,
    template_code: opts.template_code || null,
    scheme_id: schemeId,
    gaps: [],
    config_snapshot: runConfig?.config_json || {},
    warnings: [],
    skipped: true,
    note: '本方案齐全度门禁尚未覆盖，仍走原有校验',
  };
}

/**
 * Phase 0：无 Agent 时把 gaps 转为阻断信封（后续 Pipeline 复用同一形状）
 */
function buildAutofillBlockedEnvelope({
  item,
  env,
  assessment,
  intent = null,
  filled = [],
  pipeline_step = 'gate',
}) {
  const missing_fixed = (assessment.gaps || [])
    .filter(g => g.role === 'fixed')
    .map(g => ({
      field: g.field,
      expected_source: g.expected_source || 'config_json | env | api_template',
      detail: g.reason,
    }));
  const missing_variable_unresolved = (assessment.gaps || [])
    .filter(g => g.role === 'variable')
    .map(g => ({
      field: g.field,
      hint: g.reason,
    }));

  return {
    code: 'CONFIG_AUTOFILL_BLOCKED',
    message: '执行前配置不齐全：缺少必填配置项（Phase 0 Gate，尚未调用补齐 Agent）',
    item_id: item?.item_id || null,
    project_code: item?.project_code || null,
    env_id: env?.id || null,
    env_name: env?.name || null,
    intent,
    config_snapshot: assessment.config_snapshot || {},
    filled,
    missing_fixed,
    missing_variable_unresolved,
    gaps: assessment.gaps || [],
    warnings: assessment.warnings || [],
    pipeline_step,
    agent_explanation: {
      summary: '配置齐全度门禁未通过；固定字段缺失将阻断执行，变量类缺口需前置模板或环境变量。',
      reasons: (assessment.gaps || []).map(g => ({ field: g.field, reason: g.reason })),
      missing_prerequisites: missing_fixed.map(m => m.detail),
    },
  };
}

function throwAutofillBlocked(envelope) {
  const err = new Error(envelope.message);
  err.status = 400;
  err.code = envelope.code;
  err.data = envelope;
  throw err;
}

module.exports = {
  assessDetCompleteness,
  assessConfigCompleteness,
  buildAutofillBlockedEnvelope,
  throwAutofillBlocked,
};
