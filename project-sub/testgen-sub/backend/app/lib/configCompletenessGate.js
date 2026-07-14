'use strict';

const { EXTRACT_RUNTIME_NOTE } = require('./extractRuntimeNote');
const { collectPlaceholders } = require('../service/execution/runners/detPreflightRunner');

const BODY_METHODS = new Set([ 'POST', 'PUT', 'PATCH' ]);

/**
 * 执行期齐全度只认 ft_run_config.config_json，不用 item 元数据冒充「已可执行」。
 * item 上的 path/method/status 仅作补齐候选（由 AutofillPipeline / N3 写入 config_json）。
 *
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
    endpoint_path: configJson.endpoint_path || configJson.path || null,
    http_method: configJson.http_method || configJson.method || null,
    http_status_expected: configJson.http_status_expected ?? configJson.expect_status ?? null,
    headers: configJson.headers || {},
    body: configJson.body != null ? configJson.body : null,
    preflight_api_template_id: configJson.preflight_api_template_id || null,
    preflight_include_main_request: configJson.preflight_include_main_request,
    assertions: configJson.assertions || [],
    // 仅提示：用例表上有候选字段，但尚未写入执行配置
    item_hints: {
      endpoint_path: item?.endpoint_path || null,
      http_method: item?.http_method || null,
      http_status_expected: item?.http_status_expected ?? null,
    },
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
    const fromItem = Boolean(item?.endpoint_path);
    gaps.push({
      field: 'endpoint_path',
      // 用例表已有 → 结构补齐，不算「环境/模板固定值缺失」
      role: fromItem ? 'structure' : 'fixed',
      reason: fromItem
        ? `执行配置尚未保存 Path（用例表候选：${item.endpoint_path}，将由自动补齐写入）`
        : '缺少主请求 Path',
      suggest: item?.endpoint_path || undefined,
    });
  }
  if (!snapshot.http_method) {
    const fromItem = Boolean(item?.http_method);
    gaps.push({
      field: 'http_method',
      role: fromItem ? 'structure' : 'fixed',
      reason: fromItem
        ? `执行配置尚未保存 HTTP 方法（界面可能显示用例表上的 ${item.http_method}，须保存到执行配置或由自动补齐写入）`
        : '缺少 HTTP 方法',
      suggest: item?.http_method || undefined,
    });
  }
  if (snapshot.http_status_expected == null || snapshot.http_status_expected === '') {
    const fromItem = item?.http_status_expected != null && item?.http_status_expected !== '';
    gaps.push({
      field: 'http_status_expected',
      role: fromItem ? 'structure' : 'fixed',
      reason: fromItem
        ? `执行配置尚未保存期望状态码（用例表候选：${item.http_status_expected}）`
        : '缺少期望状态码',
      suggest: item?.http_status_expected,
    });
  }

  const method = String(
    snapshot.http_method || item?.http_method || 'GET',
  ).toUpperCase();
  if (BODY_METHODS.has(method) && (snapshot.body == null || snapshot.body === '')) {
    gaps.push({
      field: 'body',
      role: 'structure',
      reason: 'POST/PUT/PATCH 缺少 body；须由结构补齐写入（含 {{var}} 或故意 omit）',
    });
  }

  const pathForPlaceholders = snapshot.endpoint_path || item?.endpoint_path || '';
  const pathPlaceholders = collectPlaceholders(pathForPlaceholders);
  // OpenAPI 风格 :param → 仍依赖变量池，避免当作「齐全」直接打到服务
  const colonParams = [ ...String(pathForPlaceholders).matchAll(/:([A-Za-z_][\w]*)/g) ]
    .map(m => m[1])
    .filter(p => p && p !== 'http' && p !== 'https');

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

  for (const key of colonParams) {
    if (pathPlaceholders.includes(key)) continue;
    gaps.push({
      field: `path.:${key}`,
      role: 'structure',
      reason: `Path 含 :${key}，须改为 {{${key}}} 并由前置模板/变量解析，否则请求会带未替换段`,
    });
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

  // fixed + structure 均触发 Autofill；variable 仅提示不阻断「完整」判定以外的执行（仍进 pipeline）
  const needsAutofill = gaps.some(g => g.role === 'fixed' || g.role === 'structure');
  return {
    complete: !needsAutofill,
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
  const { configFieldLabel, formatMissingFieldLine } = require('./configFieldLabels');

  const missing_fixed = (assessment.gaps || [])
    .filter(g => g.role === 'fixed')
    .map(g => ({
      field: g.field,
      label: configFieldLabel(g.field),
      expected_source: g.expected_source || 'config_json | env | api_template',
      detail: g.reason,
    }));
  const missing_variable_unresolved = (assessment.gaps || [])
    .filter(g => g.role === 'variable')
    .map(g => ({
      field: g.field,
      label: configFieldLabel(g.field),
      hint: g.reason,
    }));
  const structure_pending = (assessment.gaps || [])
    .filter(g => g.role === 'structure')
    .map(g => ({
      field: g.field,
      label: configFieldLabel(g.field),
      detail: g.reason,
      suggest: g.suggest,
    }));

  const missingLines = missing_fixed.map(formatMissingFieldLine);
  const message = missingLines.length
    ? `执行前配置不齐全：${missingLines.join('；')}`
    : '执行前配置不齐全：缺少必填配置项（固定值无法从环境/模板解析）';

  return {
    code: 'CONFIG_AUTOFILL_BLOCKED',
    message,
    item_id: item?.item_id || null,
    project_code: item?.project_code || null,
    env_id: env?.id || null,
    env_name: env?.name || null,
    intent,
    config_snapshot: assessment.config_snapshot || {},
    filled,
    missing_fixed,
    missing_variable_unresolved,
    structure_pending,
    gaps: assessment.gaps || [],
    warnings: assessment.warnings || [],
    pipeline_step,
    agent_explanation: {
      summary: '配置齐全度门禁未通过；下列固定项无法从环境/模板解析，须先补齐后再执行。',
      reasons: (assessment.gaps || []).map(g => ({
        field: g.field,
        label: configFieldLabel(g.field),
        reason: g.reason,
      })),
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
