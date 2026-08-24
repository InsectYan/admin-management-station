'use strict';

const {
  resolveTemplateCodeFromItem,
  TEMPLATE_NAMES,
  SCHEME_TO_TEMPLATE,
} = require('./configTemplateRegistry');

/** explain 专用：配置/响应可稍长，便于 AI 对照 */
const BODY_MAX = 6000;
const FIELD_MAX = 1200;

function truncateExplainText(value, max = 2048) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function assertionEntries(detail) {
  if (Array.isArray(detail)) return detail;
  if (detail && typeof detail === 'object' && Array.isArray(detail.assertions)) {
    return detail.assertions;
  }
  return [];
}

function unwrapResultDetail(row) {
  const detail = row.assertion_detail;
  const isWrapped = detail && typeof detail === 'object' && !Array.isArray(detail);
  return {
    isWrapped,
    detail,
    artifacts: isWrapped ? (detail.artifacts || {}) : {},
    semantic: isWrapped ? (detail.semantic || detail.artifacts?.semantic) : null,
    phase: isWrapped ? detail.phase : null,
    assertions: assertionEntries(detail),
  };
}

function inferRunnerType(artifacts, assertions) {
  if (artifacts.cli) return 'cli';
  if (artifacts.http || artifacts.submit || artifacts.poll) return 'http';
  if (artifacts.perf || artifacts.k6) return 'load';
  if (assertions.some(a => a.type === 'manual_queue' || a.type === 'human_review')) return 'manual';
  const runner = assertions.find(a => a.runner)?.runner;
  return runner || 'unknown';
}

function collectAssertionSummary(assertions) {
  const failed = assertions.filter(a =>
    a.pass === false || a.ok === false || a.status === 'fail' || a.status === 'failed',
  );
  const types = [ ...new Set(assertions.map(a => a.type).filter(Boolean)) ];
  const failureText = failed.length
    ? failed.map(a =>
      `${a.type || 'assert'}: ${a.message || a.detail || a.reason || truncateExplainText(a, 120)}`,
    ).join('; ')
    : null;
  return { failed, types, failureText };
}

function extractTemplateHints(templateCode, artifacts, semantic, assertions) {
  const hints = [];
  if (templateCode === 'TPL-API-CTX') {
    if (artifacts.poll) hints.push('api_ctx: 含 poll 阶段');
    if (artifacts.submit) hints.push('api_ctx: 含 submit 阶段');
    if (semantic) hints.push('api_ctx: 含语义比对');
  }
  if (templateCode === 'TPL-CHAIN' && artifacts.vars) {
    hints.push(`chain: extract 变量 ${Object.keys(artifacts.vars).join(', ')}`);
  }
  if (templateCode === 'TPL-LOAD' && artifacts.perf) {
    const p = artifacts.perf;
    hints.push(`load: p95=${p.p95_ms ?? '—'}ms err=${p.error_rate ?? '—'}`);
  }
  if (templateCode === 'TPL-OBS' && artifacts.trace_id) {
    hints.push(`obs: trace_id=${artifacts.trace_id}`);
  }
  if (templateCode === 'TPL-MAN' || assertions.some(a => a.type === 'manual_queue')) {
    hints.push('manual: 人工评审');
  }
  if (templateCode === 'TPL-NEG') hints.push('neg: 对抗/注入');
  return hints;
}

function pickConfigBundle(configJson = {}) {
  const cfg = configJson && typeof configJson === 'object' ? configJson : {};
  return {
    endpoint_path: cfg.endpoint_path || cfg.path || null,
    method: cfg.http_method || cfg.method || null,
    body: cfg.body ?? null,
    headers: cfg.headers || {},
    http_status_expected: cfg.http_status_expected ?? null,
    assertions: Array.isArray(cfg.assertions) ? cfg.assertions : [],
    test_steps: Array.isArray(cfg.test_steps) ? cfg.test_steps : [],
    assertion_points: cfg.assertion_points || [],
    test_input_example: cfg.test_input_example || null,
    execution_mode: cfg.execution_mode || null,
    use_api_template: cfg.use_api_template === true,
    api_template_id: cfg.api_template_id || null,
    preflight_api_template_id: cfg.preflight_api_template_id || null,
  };
}

function buildAssertionDiffs(assertions = []) {
  return assertions.map(a => {
    const rule = a.rule || a;
    const ok = !(a.pass === false || a.ok === false || a.status === 'fail' || a.status === 'failed');
    return {
      ok,
      type: a.type || rule.type || null,
      path: rule.path || a.path || null,
      expect: rule.expect !== undefined ? rule.expect : a.expect,
      actual: a.actual !== undefined ? a.actual : a.actual_status,
      message: a.message || a.detail || a.reason || null,
    };
  });
}

/**
 * 将 ft_run_result 转为 fitness-judge-skill explain 所需的 observation
 */
function buildExplainObservationFromResult(row, item, ctx = {}) {
  const { artifacts, semantic, phase, assertions } = unwrapResultDetail(row);
  const http = artifacts.http || artifacts.poll?.http || artifacts.submit?.http;
  const cli = artifacts.cli;
  const { failed, types, failureText } = collectAssertionSummary(assertions);
  const templateCode = ctx.template_code || resolveTemplateCodeFromItem(item || {});
  const assertionDiffs = buildAssertionDiffs(assertions);

  let httpStatus = http?.statusCode ?? null;
  if (httpStatus == null && cli?.exitCode != null) {
    httpStatus = cli.exitCode === 0 ? 200 : 500;
  }
  if (httpStatus == null) {
    for (const a of assertions) {
      if (a.actual_status != null) httpStatus = a.actual_status;
      else if (a.status_code != null) httpStatus = a.status_code;
    }
    const m = String(row.output_summary || '').match(/HTTP\s+(\d{3})/i);
    if (httpStatus == null && m) httpStatus = Number(m[1]);
  }

  let responseBody = null;
  let responseExcerpt = '';
  if (http?.body != null) {
    responseBody = http.body;
    responseExcerpt = truncateExplainText(http.body, BODY_MAX);
  } else if (cli?.stderr) {
    responseExcerpt = truncateExplainText(cli.stderr, BODY_MAX);
  } else if (cli?.stdout || artifacts.output_tail) {
    responseExcerpt = truncateExplainText(cli?.stdout || artifacts.output_tail, BODY_MAX);
  } else if (row.output_summary) {
    responseExcerpt = truncateExplainText(row.output_summary, FIELD_MAX);
  }

  const templateHints = extractTemplateHints(templateCode, artifacts, semantic, assertions);
  const configBundle = ctx.config_bundle || pickConfigBundle(ctx.config_json || {});

  return {
    sub_run_index: row.sub_index,
    sub_verdict: row.sub_verdict,
    pass: row.sub_verdict === 'pass',
    verdict: row.sub_verdict,
    runner_type: inferRunnerType(artifacts, assertions),
    template_code: templateCode,
    scheme_id: ctx.scheme_id || item?.scheme_primary_id || null,
    phase: phase || null,
    http_status: httpStatus,
    request_url: http?.url || null,
    request_method: http?.method || configBundle.method || null,
    input_summary: row.input_summary || '',
    output_summary: row.output_summary || '',
    response_excerpt: responseExcerpt,
    response_body: responseBody,
    expected_hint: item?.expected_observation || item?.expected_result || '',
    /** 三角对照：配置期望 / 文案目标 / 实际 */
    config_expect: {
      http_status_expected: configBundle.http_status_expected,
      assertions: configBundle.assertions,
      test_steps: configBundle.test_steps,
      assertion_points: configBundle.assertion_points,
    },
    target_expect: {
      expected_observation: item?.expected_observation || '',
      http_status_expected: item?.http_status_expected ?? configBundle.http_status_expected,
      endpoint_path: item?.endpoint_path || configBundle.endpoint_path,
    },
    actual: {
      http_status: httpStatus,
      body: responseBody,
      assertion_results: assertionDiffs,
    },
    assertion_diffs: assertionDiffs,
    assertion_failures: failureText,
    assertion_types: types,
    semantic_summary: semantic
      ? truncateExplainText(typeof semantic === 'string' ? semantic : semantic.summary || semantic, 600)
      : null,
    poll_status: artifacts.poll?.http?.statusCode ?? artifacts.poll_status ?? null,
    template_hints: templateHints.length ? templateHints.join(' · ') : null,
    perf_summary: artifacts.perf ? truncateExplainText(artifacts.perf, 400) : null,
    error_message: cli?.stderr
      ? truncateExplainText(
        String(cli.stderr).split('\n').find(l => /Error:|FAIL|ENOENT|MODULE_NOT_FOUND/i.test(l)) || cli.stderr,
        500,
      )
      : (artifacts.error || row.error_message || null),
    cli_command: cli?.command || null,
    cli_exit_code: cli?.exitCode ?? null,
    cli_cwd: cli?.cwd || null,
    failed_assertion_count: failed.length,
  };
}

function buildRunExplainContext(runData, item, runConfig, results, env = null) {
  const passCount = results.filter(r => r.sub_verdict === 'pass').length;
  const failCount = results.filter(r => r.sub_verdict === 'fail').length;
  const templateCode = resolveTemplateCodeFromItem(item || {});
  const schemeId = runData.scheme_id || item?.scheme_primary_id || null;
  const configJson = runConfig?.config_json || {};
  const configBundle = pickConfigBundle(configJson);

  return {
    status: runData.status,
    verdict: runData.verdict,
    scheme_id: schemeId,
    template_code: templateCode,
    template_name: TEMPLATE_NAMES[templateCode] || SCHEME_TO_TEMPLATE[schemeId] || templateCode,
    validation_id: runData.validation_id,
    item_id: runData.item_id,
    item_name: item?.item_name || '',
    category_major_id: item?.category_major_id || '',
    detail_summary: item?.detail_summary || '',
    expected_observation: item?.expected_observation || '',
    pass_count: passCount,
    fail_count: failCount,
    total_count: results.length,
    error_message: runData.error_message || null,
    progress: runData.progress || {},
    threshold_json: runConfig?.threshold_json || {},
    env_id: runData.env_id || null,
    env_name: env?.name || null,
    base_url: env?.bff_coach_url || env?.base_url || null,
    /** 完整可执行配置（供 AI 对照） */
    config_json: configBundle,
    config_raw: truncateExplainText(configJson, BODY_MAX),
  };
}

/**
 * 组装 explain 专用三块文本（配置 / 目标 / 实际）
 */
function buildExplainTriadTexts(runContext, observations = []) {
  const cfg = runContext.config_json || {};
  const config_text = [
    '【配置项 config】',
    `- 模板/方案/判定: ${runContext.template_code || '—'} / ${runContext.scheme_id || '—'} / ${runContext.validation_id || '—'}`,
    `- 环境: ${runContext.env_name || runContext.env_id || '—'} · base=${runContext.base_url || '—'}`,
    `- 请求: ${cfg.method || '—'} ${cfg.endpoint_path || '—'}`,
    `- http_status_expected: ${cfg.http_status_expected ?? '—'}`,
    `- assertions: ${JSON.stringify(cfg.assertions || [])}`,
    `- test_steps: ${JSON.stringify(cfg.test_steps || [])}`,
    `- assertion_points: ${JSON.stringify(cfg.assertion_points || [])}`,
    `- body: ${truncateExplainText(cfg.body, 1500)}`,
  ].join('\n');

  const expected_text = [
    '【目标项 expected / 文案期望】',
    `- expected_observation: ${runContext.expected_observation || '—'}`,
    `- detail_summary: ${truncateExplainText(runContext.detail_summary || '—', 400)}`,
    `- 用例期望状态码(item): ${observations[0]?.target_expect?.http_status_expected ?? '—'}`,
    '- 说明: test_steps/assertion_points 为自然语言目标；assertions.expect 为可执行期望，二者冲突时以可执行断言为准并应指出矛盾',
  ].join('\n');

  const actualBlocks = observations.map((o, i) => {
    const diffs = (o.assertion_diffs || [])
      .map(d => `  - [${d.ok ? 'PASS' : 'FAIL'}] ${d.type}${d.path ? ` ${d.path}` : ''}: expect=${JSON.stringify(d.expect)} actual=${JSON.stringify(d.actual)} | ${d.message || ''}`)
      .join('\n');
    return [
      `### 子项 #${o.sub_run_index ?? i} · ${o.sub_verdict || '—'}`,
      `- 请求: ${o.request_method || '—'} ${o.request_url || o.input_summary || '—'}`,
      `- HTTP: ${o.http_status ?? '—'}`,
      `- 断言对照:\n${diffs || '  （无断言明细）'}`,
      `- 响应体: ${o.response_excerpt || '—'}`,
    ].join('\n');
  });

  const actual_text = [ '【实际返回 actual】', ...actualBlocks ].join('\n\n');

  const failLines = [];
  for (const o of observations) {
    for (const d of o.assertion_diffs || []) {
      if (!d.ok) {
        failLines.push(
          `- 子项#${o.sub_run_index}: ${d.type}${d.path ? ` ${d.path}` : ''} | expect=${JSON.stringify(d.expect)} | actual=${JSON.stringify(d.actual)} | ${d.message || ''}`,
        );
      }
    }
    if (o.assertion_failures && !(o.assertion_diffs || []).some(d => !d.ok)) {
      failLines.push(`- 子项#${o.sub_run_index}: ${o.assertion_failures}`);
    }
  }
  const assertion_diff_text = [
    '【已失败断言（优先据此定位根因）】',
    failLines.length ? failLines.join('\n') : '- （未解析到失败断言行，请结合实际 HTTP/响应判断）',
  ].join('\n');

  return { config_text, expected_text, actual_text, assertion_diff_text };
}

module.exports = {
  truncateExplainText,
  pickConfigBundle,
  buildExplainObservationFromResult,
  buildRunExplainContext,
  buildExplainTriadTexts,
};
