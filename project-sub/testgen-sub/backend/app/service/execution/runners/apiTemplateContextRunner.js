'use strict';

const { randomUUID } = require('crypto');
const { executeMatrixRow } = require('./matrixRowRunner');
const { applyExtract, applyVarsToRow } = require('./varPool');
const { expandApiTemplateRuns, resolveInputParams } = require('../../../lib/apiTemplateRender');
const { applyStepInputParams } = require('../../../lib/apiTemplateParamBind');
const { executeApiCtxCase } = require('./apiCtxCaseRunner');

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
    uuid: randomUUID(),
    ...resolveInputParams(tpl.input_params_schema, inputParams),
  };

  const preflight = tpl.preflight_steps || [];
  for (let i = 0; i < preflight.length; i += 1) {
    const rawStep = preflight[i];
    let row = applyVarsToRow(rawStep, vars);
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

  const httpRuns = expandApiTemplateRuns(tpl, injectBindings, sampleRows, vars);
  const pollCfg = tpl.poll_json && Object.keys(tpl.poll_json).length
    ? { enabled: true, ...tpl.poll_json }
    : null;

  for (let j = 0; j < httpRuns.length; j += 1) {
    const req = httpRuns[j];
    const caseVars = { ...vars, uuid: randomUUID() };
    const rawCase = {
      name: `case-${j + 1}`,
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: req.body,
      expect_status: tpl.expect_status || 202,
      forbidden_patterns: tpl.forbidden_patterns || [],
      extract: pollCfg ? { turn_id: '$.turn_id' } : undefined,
      poll: pollCfg,
    };

    const sub = await executeApiCtxCase(ctx, rawCase, caseVars, {
      case_index: results.length,
      step_index: globalStepIndex,
      case_name: rawCase.name,
    });
    globalStepIndex += sub.steps?.length || 1;
    results.push(sub);
  }

  return results;
}

module.exports = { executeApiTemplateContext };
