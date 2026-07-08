'use strict';

const { executeMatrixRow } = require('./matrixRowRunner');
const { applyExtract, applyVarsToRow } = require('./varPool');
const { scanForbidden } = require('./forbiddenScan');
const { extractResponseText } = require('../../../lib/apiCtxContent');
const {
  normalizePollConfig,
  pollStatusMatchesUntil,
  resolvePollUntilMatchers,
  resolveTerminalFailStatuses,
} = require('../../../lib/apiCtxPoll');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** @param {unknown} status */
function normPollStatus(status) {
  return String(status ?? '').trim().toLowerCase();
}

/** @param {string} path */
function isTurnSubmitPath(path) {
  return /\/turns\/submit/i.test(String(path || ''));
}

/** @param {object} rawCase */
function resolvePollConfig(rawCase) {
  const poll = rawCase.poll;
  if (poll === false || poll?.enabled === false) return null;
  if (poll === true || poll?.enabled === true || rawCase.poll_after_submit) {
    return normalizePollConfig({
      path: '/api/chat/turns/{{turn_id}}',
      method: 'GET',
      expect_status: 200,
      max_attempts: 30,
      interval_ms: 2000,
      extract: { turn_id: '$.turn_id' },
      forbidden_on: 'poll',
      until_json_path: '$.status',
      until_alias_group: 'async_job_success',
      terminal_fail_alias_group: 'async_job_fail',
      ...(typeof poll === 'object' ? poll : {}),
      enabled: true,
    });
  }
  if (poll && typeof poll === 'object' && poll.enabled !== false) {
    return normalizePollConfig({
      path: '/api/chat/turns/{{turn_id}}',
      method: 'GET',
      expect_status: 200,
      max_attempts: 30,
      interval_ms: 2000,
      extract: { turn_id: '$.turn_id' },
      forbidden_on: 'poll',
      until_json_path: '$.status',
      until_alias_group: 'async_job_success',
      terminal_fail_alias_group: 'async_job_fail',
      ...poll,
    });
  }
  return null;
}

/**
 * @param {object} submitSub
 * @param {object} rawCase
 * @param {object[]} details
 */
function applySubmitAssertions(submitSub, rawCase, details) {
  const http = submitSub.artifacts?.http;
  if (!http) return submitSub.sub_verdict === 'pass';

  const accepts = Array.isArray(rawCase.accept_statuses) && rawCase.accept_statuses.length
    ? rawCase.accept_statuses.map(Number)
    : [ Number(rawCase.expect_status ?? 200) ];
  const statusOk = accepts.includes(Number(http.statusCode));

  const statusDetail = details.find(d => d.type === 'status') || {
    type: 'status',
    expect: accepts[0],
    actual: http.statusCode,
    ok: statusOk,
    message: statusOk ? 'status match' : `expected one of ${accepts.join('/')}, got ${http.statusCode}`,
  };
  statusDetail.expect = accepts;
  statusDetail.actual = http.statusCode;
  statusDetail.ok = statusOk;
  statusDetail.message = statusOk
    ? 'status match'
    : `expected one of ${accepts.join('/')}, got ${http.statusCode}`;

  const idx = details.findIndex(d => d.type === 'status');
  if (idx >= 0) details[idx] = statusDetail;
  else details.unshift(statusDetail);

  let businessOk = true;
  const body = http.body;
  if (body && typeof body === 'object' && 'turn_id' in body) {
    if (body.created === false) {
      businessOk = false;
      details.push({
        type: 'submit_business',
        ok: false,
        message: 'submit 幂等重放（created=false），未创建新 turn；请检查 client_turn_id 是否每条样本唯一',
        turn_id: body.turn_id,
        status: body.status,
      });
    } else if (body.status === 'failed') {
      businessOk = false;
      details.push({
        type: 'submit_business',
        ok: false,
        message: 'submit 立即返回 status=failed',
        turn_id: body.turn_id,
      });
    }
  }

  const pass = statusOk && businessOk;
  submitSub.sub_verdict = pass ? 'pass' : 'fail';
  return pass;
}

/**
 * @param {import('../runOrchestrator').ExecutionContext} ctx
 * @param {object} rawCase
 * @param {Record<string, unknown>} caseVars
 * @param {{ step_index: number, case_index: number, case_name: string }} meta
 */
async function executeApiCtxCase(ctx, rawCase, caseVars, meta) {
  const { forbidden_patterns: forbidden = [] } = rawCase;
  const pollCfg = resolvePollConfig(rawCase);
  const forbiddenOn = pollCfg?.forbidden_on || (pollCfg ? 'poll' : 'submit');

  const submitRow = applyVarsToRow({ runner: 'http', ...rawCase }, caseVars);
  const submitSub = await executeMatrixRow(ctx, submitRow, meta.case_index, {
    step_index: meta.step_index,
    source: 'api_case_submit',
    step_name: `${meta.case_name} · submit`,
  });

  const details = Array.isArray(submitSub.assertion_detail)
    ? [ ...submitSub.assertion_detail ]
    : submitSub.assertion_detail ? [ submitSub.assertion_detail ] : [];

  if (isTurnSubmitPath(submitRow.path) || Array.isArray(rawCase.accept_statuses)) {
    applySubmitAssertions(submitSub, rawCase, details);
  }

  let pollSub = null;
  let assertBody = submitSub.artifacts?.http?.body;
  let caseVerdict = submitSub.sub_verdict;

  if (caseVerdict === 'pass' && pollCfg) {
    const extractMap = {
      ...(pollCfg.extract || {}),
      ...(rawCase.extract || {}),
    };
    if (submitSub.artifacts?.http?.body && Object.keys(extractMap).length) {
      applyExtract(caseVars, submitSub.artifacts.http.body, extractMap);
    }

    const maxAttempts = Number(pollCfg.max_attempts) || 30;
    const intervalMs = Number(pollCfg.interval_ms) || 2000;
    const pollRow = applyVarsToRow({
      runner: 'http',
      method: pollCfg.method || 'GET',
      path: pollCfg.path,
      expect_status: pollCfg.expect_status ?? 200,
      headers: pollCfg.headers,
    }, caseVars);

    const terminalFails = resolveTerminalFailStatuses(pollCfg);
    const untilMatchers = resolvePollUntilMatchers(pollCfg);
    let untilOk = true;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) await sleep(intervalMs);
      pollSub = await executeMatrixRow(ctx, pollRow, meta.case_index, {
        step_index: meta.step_index + 1,
        source: 'api_case_poll',
        step_name: `${meta.case_name} · poll #${attempt + 1}`,
      });
      const pollBody = pollSub.artifacts?.http?.body;
      const pollStatus = pollBody && typeof pollBody === 'object'
        ? normPollStatus(pollBody.status)
        : '';
      if (pollStatus && terminalFails.includes(pollStatus)) {
        untilOk = true;
        caseVerdict = 'fail';
        details.push({
          type: 'turn_status',
          ok: false,
          message: `turn 终态 ${pollStatus}${pollBody?.error ? `: ${pollBody.error}` : ''}`,
          status: pollStatus,
        });
        break;
      }

      const statusOk = pollSub.sub_verdict === 'pass';
      untilOk = pollStatusMatchesUntil(pollBody, pollCfg);
      if (statusOk && untilOk) break;
    }

    assertBody = pollSub?.artifacts?.http?.body;
    if (caseVerdict !== 'fail') {
      caseVerdict = pollSub?.sub_verdict === 'pass' && untilOk ? 'pass' : 'fail';
    }
    if (pollSub && caseVerdict === 'fail' && !details.some(d => d.type === 'turn_status')) {
      details.push({
        type: 'poll',
        ok: false,
        message: untilOk
          ? `poll 未在 ${maxAttempts} 次内达到 expect_status`
          : `poll 未在 ${maxAttempts} 次内达到 until 条件 (${pollCfg.until_json_path}∈{${untilMatchers.describe}})`,
      });
    }
  }

  const shouldCheckForbidden = forbidden.length
    && ((forbiddenOn === 'poll' && pollCfg) || forbiddenOn === 'submit' || forbiddenOn === 'both');
  if (shouldCheckForbidden && assertBody != null) {
    const bodiesToScan = forbiddenOn === 'both'
      ? [ submitSub.artifacts?.http?.body, assertBody ].filter(b => b != null)
      : [ assertBody ];
    for (const body of bodiesToScan) {
      const hit = scanForbidden(body, forbidden);
      if (hit) {
        caseVerdict = 'fail';
        details.push({
          type: 'forbidden_pattern',
          pattern: hit,
          ok: false,
          message: `响应含禁止 pattern: ${hit}`,
        });
        break;
      }
    }
  } else if (shouldCheckForbidden && pollCfg && !assertBody) {
    caseVerdict = 'fail';
    details.push({
      type: 'forbidden_pattern',
      ok: false,
      message: 'poll 无响应体，无法校验 forbidden_patterns',
    });
  }

  const outputParts = [ submitSub.output_summary ];
  if (pollSub) outputParts.push(pollSub.output_summary);

  const injectMessage = typeof submitRow.body?.message === 'string'
    ? submitRow.body.message.trim()
    : String(meta.inject_values?.message ?? meta.inject_values?.text ?? '').trim();
  const responseText = extractResponseText(assertBody, rawCase.content_extract_paths);
  const httpSummary = outputParts.join(' → ');

  return {
    sub_index: meta.case_index,
    phase: 'api_case',
    counts_metric: true,
    input_summary: injectMessage || submitSub.input_summary,
    output_summary: responseText || httpSummary,
    assertion_detail: details,
    functional_verdict: caseVerdict,
    sub_verdict: caseVerdict,
    artifacts: {
      http: pollSub?.artifacts?.http || submitSub.artifacts?.http,
      submit: submitSub.artifacts,
      poll: pollSub?.artifacts,
      vars: { ...caseVars },
      inject_message: injectMessage,
      inject_values: meta.inject_values || {},
      response_text: responseText,
      http_summary: httpSummary,
    },
    steps: pollSub ? [ submitSub, pollSub ] : [ submitSub ],
  };
}

module.exports = {
  executeApiCtxCase,
  resolvePollConfig,
  isTurnSubmitPath,
};
