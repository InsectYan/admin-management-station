'use strict';

const { randomUUID } = require('crypto');
const { resolveInputParams } = require('../../../lib/apiTemplateRender');
const { applyStepInputParams } = require('../../../lib/apiTemplateParamBind');
const { applyExtract, applyVarsToRow } = require('./varPool');
const { executeMatrixRow } = require('./matrixRowRunner');

/**
 * 执行接口模板前置链路，将 extract / export_schema 写入变量池
 * @param {import('../runOrchestrator').ExecutionContext} ctx
 * @param {number} templateId
 * @param {object} [inputParams]
 */
async function runDetPreflight(ctx, templateId, inputParams = {}) {
  const template = await ctx.ctx.model.FtApiTemplate.findByPk(templateId);
  if (!template || !template.is_active) {
    const err = new Error(`前置接口模板 #${templateId} 不存在或已停用`);
    err.status = 400;
    err.code = 'PREFLIGHT_TEMPLATE_NOT_FOUND';
    throw err;
  }

  const tpl = template.toJSON();
  const vars = {
    ...(ctx.globalRequestContext?.vars || {}),
    ...resolveInputParams(tpl.input_params_schema, inputParams),
  };

  const preflight = tpl.preflight_steps || [];
  if (!preflight.length) {
    return { ok: true, vars, template: tpl, steps: [] };
  }

  const steps = [];
  for (let i = 0; i < preflight.length; i += 1) {
    const rawStep = preflight[i];
    let row = applyVarsToRow({ ...rawStep, uuid: randomUUID() }, vars);
    row = applyStepInputParams(row, vars, tpl.input_params_schema || []);
    const sub = await executeMatrixRow(ctx, row, i, {
      step_index: i,
      source: 'preflight',
      step_name: rawStep.name || rawStep.path || `preflight-${i + 1}`,
    });
    steps.push(sub);

    if (sub.artifacts?.http?.body && rawStep.extract) {
      applyExtract(vars, sub.artifacts.http.body, rawStep.extract);
    }

    if (sub.sub_verdict !== 'pass' && rawStep.stop_on_fail !== false) {
      return { ok: false, vars, template: tpl, steps, failedStep: sub };
    }
  }

  for (const field of tpl.export_schema || []) {
    if (!field?.key) continue;
    const lastHttp = [ ...steps ].reverse().find(s => s.artifacts?.http?.body);
    if (lastHttp?.artifacts?.http?.body && field.json_path) {
      applyExtract(vars, lastHttp.artifacts.http.body, { [field.key]: field.json_path });
    }
  }

  return { ok: true, vars, template: tpl, steps };
}

module.exports = { runDetPreflight };
