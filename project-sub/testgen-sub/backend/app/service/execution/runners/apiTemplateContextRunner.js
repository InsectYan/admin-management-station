'use strict';

const { randomUUID } = require('crypto');
const { executeMatrixRow } = require('./matrixRowRunner');
const { applyExtract, applyVarsToRow } = require('./varPool');
const { renderApiTemplateCases, resolveInputParams } = require('../../../lib/apiTemplateRender');
const { applyStepInputParams } = require('../../../lib/apiTemplateParamBind');
const { executeApiCtxCase } = require('./apiCtxCaseRunner');
const { normalizePollConfig } = require('../../../lib/apiCtxPoll');

/** @param {object} tpl */
function resolveApiTemplatePoll(tpl) {
  const pollJson = tpl.poll_json;
  if (pollJson && typeof pollJson === 'object' && Object.keys(pollJson).length && pollJson.enabled !== false) {
    return normalizePollConfig({ enabled: true, ...pollJson });
  }
  if (pollJson && typeof pollJson === 'object' && pollJson.enabled === false) {
    return null;
  }

  const path = String(tpl.url_path || '');
  if (/\/turns\/submit/i.test(path)) {
    return {
      enabled: true,
      path: '/api/chat/turns/{{turn_id}}',
      method: 'GET',
      expect_status: 200,
      max_attempts: 60,
      interval_ms: 2000,
      until_json_path: '$.status',
      until_alias_group: 'async_job_success',
      terminal_fail_alias_group: 'async_job_fail',
      forbidden_on: 'poll',
    };
  }
  return null;
}

/**
 * 接口模板完整执行：外部入参 → preflight → 注入展开 → submit/poll/forbidden
 * @param {import('../runOrchestrator').ExecutionContext} ctx
 * @param {object} template ft_api_template row
 * @param {object} options
 */
async function executeApiTemplateContext(ctx, template, options = {}) {
  const {
    inputParams = {},
    injectBindings = {},
    sampleRows = [],
  } = options;

  const tpl = template.toJSON ? template.toJSON() : template;
  const results = [];
  let globalStepIndex = 0;

  /** @type {Record<string, unknown>} */
  const vars = {
    ...(ctx.globalRequestContext?.vars || {}),
    ...resolveInputParams(tpl.input_params_schema, inputParams),
  };

  const preflight = tpl.preflight_steps || [];
  for (let i = 0; i < preflight.length; i += 1) {
    const rawStep = preflight[i];
    let row = applyVarsToRow({ ...rawStep, uuid: randomUUID() }, vars);
    row = applyStepInputParams(row, vars, tpl.input_params_schema || []);
    const sub = await executeMatrixRow(ctx, row, results.length, {
      step_index: globalStepIndex,
      source: 'preflight',
      step_name: rawStep.name || rawStep.path || `preflight-${i + 1}`,
    });
    globalStepIndex += 1;

    if (sub.artifacts?.http?.body && rawStep.extract) {
      applyExtract(vars, sub.artifacts.http.body, rawStep.extract);
      sub.artifacts.vars = { ...vars };
    }

    results.push({
      ...sub,
      phase: 'preflight',
      counts_metric: false,
    });
    if (sub.sub_verdict !== 'pass' && rawStep.stop_on_fail !== false) {
      return results;
    }
  }

  const casePlans = renderApiTemplateCases(tpl, injectBindings, sampleRows, vars);
  const pollCfg = resolveApiTemplatePoll(tpl);

  for (let j = 0; j < casePlans.length; j += 1) {
    const { request: req, caseVars, injectValues } = casePlans[j];
    const rawCase = {
      name: `case-${j + 1}`,
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: req.body,
      expect_status: tpl.expect_status || 202,
      accept_statuses: /\/turns\/submit/i.test(String(req.path || tpl.url_path || ''))
        ? [ 202, 200 ]
        : undefined,
      forbidden_patterns: tpl.forbidden_patterns || [],
      content_extract_paths: tpl.content_extract_paths,
      extract: pollCfg ? { turn_id: '$.turn_id' } : undefined,
      poll: pollCfg,
    };

    const sub = await executeApiCtxCase(ctx, rawCase, caseVars, {
      case_index: results.length,
      step_index: globalStepIndex,
      case_name: rawCase.name,
      inject_values: injectValues,
    });
    globalStepIndex += sub.steps?.length || 1;
    results.push(sub);
  }

  return results;
}

module.exports = {
  executeApiTemplateContext,
  resolveApiTemplatePoll,
};
