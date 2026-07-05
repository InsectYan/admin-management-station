'use strict';

const { executeMatrixRow } = require('./matrixRowRunner');
const { applyExtract, applyVarsToRow, getByPath } = require('./varPool');
const { scanForbidden } = require('./forbiddenScan');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** @param {object} rawCase */
function resolvePollConfig(rawCase) {
  const poll = rawCase.poll;
  if (poll === false || poll?.enabled === false) return null;
  if (poll === true || poll?.enabled === true || rawCase.poll_after_submit) {
    return {
      path: '/api/chat/turns/{{turn_id}}',
      method: 'GET',
      expect_status: 200,
      max_attempts: 30,
      interval_ms: 2000,
      extract: { turn_id: '$.turn_id' },
      forbidden_on: 'poll',
      ...(typeof poll === 'object' ? poll : {}),
      enabled: true,
    };
  }
  if (poll && typeof poll === 'object' && poll.enabled !== false) {
    return {
      path: '/api/chat/turns/{{turn_id}}',
      method: 'GET',
      expect_status: 200,
      max_attempts: 30,
      interval_ms: 2000,
      extract: { turn_id: '$.turn_id' },
      forbidden_on: 'poll',
      ...poll,
    };
  }
  return null;
}

/** @param {unknown} body @param {string} [path] @param {unknown} [expected] */
function jsonPathEquals(body, path, expected) {
  if (!path) return true;
  const val = getByPath(body, path);
  return String(val) === String(expected);
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

    let untilOk = true;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) await sleep(intervalMs);
      pollSub = await executeMatrixRow(ctx, pollRow, meta.case_index, {
        step_index: meta.step_index + 1,
        source: 'api_case_poll',
        step_name: `${meta.case_name} · poll #${attempt + 1}`,
      });
      const statusOk = pollSub.sub_verdict === 'pass';
      untilOk = !pollCfg.until_json_path
        || jsonPathEquals(pollSub.artifacts?.http?.body, pollCfg.until_json_path, pollCfg.until_value ?? 'done');
      if (statusOk && untilOk) break;
    }

    assertBody = pollSub?.artifacts?.http?.body;
    caseVerdict = pollSub?.sub_verdict === 'pass' && untilOk ? 'pass' : 'fail';
    if (pollSub && caseVerdict === 'fail') {
      details.push({
        type: 'poll',
        ok: false,
        message: untilOk
          ? `poll 未在 ${maxAttempts} 次内达到 expect_status`
          : `poll 未在 ${maxAttempts} 次内达到 until 条件 (${pollCfg.until_json_path}=${pollCfg.until_value ?? 'done'})`,
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

  return {
    sub_index: meta.case_index,
    phase: 'api_case',
    input_summary: submitSub.input_summary,
    output_summary: outputParts.join(' → '),
    assertion_detail: details,
    sub_verdict: caseVerdict,
    artifacts: {
      http: pollSub?.artifacts?.http || submitSub.artifacts?.http,
      submit: submitSub.artifacts,
      poll: pollSub?.artifacts,
      vars: { ...caseVars },
    },
    steps: pollSub ? [ submitSub, pollSub ] : [ submitSub ],
  };
}

module.exports = {
  executeApiCtxCase,
  resolvePollConfig,
};
