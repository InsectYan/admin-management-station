'use strict';

const {
  resolveTemplateCodeFromItem,
  TEMPLATE_NAMES,
  SCHEME_TO_TEMPLATE,
} = require('./configTemplateRegistry');

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
    if (artifacts.poll) hints.push('api_ctx: 含 poll 轮询阶段');
    if (artifacts.submit) hints.push('api_ctx: 含 submit 提交阶段');
    if (semantic) hints.push('api_ctx: 含语义/观测文案比对');
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
    hints.push('manual: 人工评审队列');
  }
  if (templateCode === 'TPL-NEG') {
    hints.push('neg: 对抗/注入专项');
  }
  return hints;
}

/**
 * 将 ft_run_result 转为 fitness-judge-skill explain 所需的 observation
 * @param {object} row
 * @param {object|null} item
 * @param {{ template_code?: string, scheme_id?: string }} [ctx]
 */
function buildExplainObservationFromResult(row, item, ctx = {}) {
  const { artifacts, semantic, phase, assertions } = unwrapResultDetail(row);
  const http = artifacts.http || artifacts.poll?.http || artifacts.submit?.http;
  const cli = artifacts.cli;
  const { failed, types, failureText } = collectAssertionSummary(assertions);
  const templateCode = ctx.template_code || resolveTemplateCodeFromItem(item || {});

  let httpStatus = http?.statusCode ?? null;
  if (httpStatus == null && cli?.exitCode != null) {
    httpStatus = cli.exitCode === 0 ? 200 : 500;
  }
  if (httpStatus == null) {
    for (const a of assertions) {
      if (a.actual_status != null) httpStatus = a.actual_status;
      else if (a.status_code != null) httpStatus = a.status_code;
      else if (a.actual != null && typeof a.actual === 'number') httpStatus = a.actual;
    }
    const m = String(row.output_summary || '').match(/HTTP\s+(\d{3})/i);
    if (httpStatus == null && m) httpStatus = Number(m[1]);
  }

  let responseExcerpt = '';
  if (http?.body != null) {
    responseExcerpt = truncateExplainText(http.body);
  } else if (cli?.stderr) {
    responseExcerpt = truncateExplainText(cli.stderr);
  } else if (cli?.stdout || artifacts.output_tail) {
    responseExcerpt = truncateExplainText(cli?.stdout || artifacts.output_tail);
  } else if (row.output_summary) {
    responseExcerpt = truncateExplainText(row.output_summary);
  }

  const templateHints = extractTemplateHints(templateCode, artifacts, semantic, assertions);

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
    input_summary: row.input_summary || '',
    output_summary: row.output_summary || '',
    response_excerpt: responseExcerpt,
    expected_hint: item?.expected_observation || item?.expected_result || '',
    journey_summary: artifacts.journey || artifacts.obs || semantic || null,
    assertion_failures: failureText,
    assertion_types: types,
    semantic_summary: semantic
      ? truncateExplainText(typeof semantic === 'string' ? semantic : semantic.summary || semantic, 600)
      : null,
    poll_status: artifacts.poll?.http?.statusCode ?? artifacts.poll_status ?? null,
    template_hints: templateHints.length ? templateHints.join(' · ') : null,
    perf_summary: artifacts.perf
      ? truncateExplainText(artifacts.perf, 400)
      : null,
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

function buildRunExplainContext(runData, item, runConfig, results) {
  const passCount = results.filter(r => r.sub_verdict === 'pass').length;
  const failCount = results.filter(r => r.sub_verdict === 'fail').length;
  const templateCode = resolveTemplateCodeFromItem(item || {});
  const schemeId = runData.scheme_id || item?.scheme_primary_id || null;

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
  };
}

module.exports = {
  truncateExplainText,
  buildExplainObservationFromResult,
  buildRunExplainContext,
};
