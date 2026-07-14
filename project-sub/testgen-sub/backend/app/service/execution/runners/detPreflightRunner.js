'use strict';

const { randomUUID } = require('crypto');
const { resolveInputParams, renderApiRequest } = require('../../../lib/apiTemplateRender');
const { applyStepInputParams } = require('../../../lib/apiTemplateParamBind');
const { mergeRequestHeaders } = require('../../../lib/globalRequestContext');
const { applyExtract, applyVarsToRow } = require('./varPool');
const { executeMatrixRow } = require('./matrixRowRunner');
const { runHttp } = require('./httpRunner');
const { methodNeedsBody } = require('../../../lib/httpRequestBody');

function normalizeExportJsonPath(path) {
  const p = String(path || '').trim();
  if (!p) return '';
  if (p.startsWith('$.')) return p;
  if (p.startsWith('$')) return `$.${p.slice(1)}`;
  return `$.${p}`;
}

function collectPlaceholders(...texts) {
  const keys = new Set();
  const re = /\{\{(\w+)\}\}/g;
  for (const text of texts) {
    let m;
    const s = String(text || '');
    while ((m = re.exec(s))) keys.add(m[1]);
  }
  return [ ...keys ];
}

function missingPlaceholders(vars, keys) {
  return keys.filter(k => k !== 'uuid' && (vars[k] == null || vars[k] === ''));
}

function shouldRunTemplateMain(tpl, vars, options = {}) {
  if (options.include_main_request === false) return false;
  if (options.include_main_request === true) return true;
  const required = options.required_placeholders || [];
  const exportKeys = (tpl.export_schema || []).map(f => f.key).filter(Boolean);
  const needKeys = [ ...new Set([ ...required, ...exportKeys ]) ];
  if (!needKeys.length) return false;
  return missingPlaceholders(vars, needKeys).length > 0
    && Boolean(tpl.url_path && tpl.http_method);
}

/**
 * 执行接口模板主请求（如 submit），从响应提取 turn_id 等变量
 */
async function runTemplateMainRequest(ctx, tpl, vars, steps, inputParams = {}) {
  const rowVars = { ...vars, uuid: randomUUID() };
  if (!rowVars.message) {
    rowVars.message = inputParams.message || inputParams.preflight_message || 'testgen preflight message';
  }
  const req = renderApiRequest(tpl, {}, rowVars);
  const expectStatus = tpl.expect_status || 202;
  const acceptStatuses = /\/turns\/submit/i.test(String(tpl.url_path || ''))
    ? [ 202, 200 ]
    : [ expectStatus ];

  const httpResult = await runHttp(ctx.ctx, {
    baseUrl: ctx.env.bff_coach_url,
    path: req.path,
    method: req.method,
    headers: mergeRequestHeaders(ctx.globalRequestContext?.headers || {}, {
      'X-Test-Run-Id': String(ctx.run.id),
      'X-Test-Item-Id': ctx.item.item_id,
      ...(req.headers || {}),
    }),
    body: methodNeedsBody(req.method) ? req.body : undefined,
  });

  const statusOk = acceptStatuses.includes(httpResult.statusCode);
  const sub = {
    sub_index: steps.length,
    phase: 'preflight',
    input_summary: `${req.method} ${req.path}`,
    output_summary: `HTTP ${httpResult.statusCode} (${httpResult.responseTimeMs}ms)`,
    assertion_detail: [{
      type: 'status',
      expect: expectStatus,
      actual: httpResult.statusCode,
      ok: statusOk,
      message: statusOk ? 'template main request ok' : `template main expected ${acceptStatuses.join('|')}, got ${httpResult.statusCode}`,
    }],
    sub_verdict: statusOk ? 'pass' : 'fail',
    artifacts: { http: httpResult, source: 'template_main' },
  };
  steps.push(sub);

  if (httpResult.body && typeof httpResult.body === 'object') {
    applyExtract(vars, httpResult.body, { turn_id: '$.turn_id' });
  }

  for (const field of tpl.export_schema || []) {
    if (!field?.key) continue;
    const jp = normalizeExportJsonPath(field.json_path);
    if (httpResult.body && jp) {
      applyExtract(vars, httpResult.body, { [field.key]: jp });
    }
  }

  return { ok: statusOk, sub };
}

/**
 * 执行接口模板前置链路，将 extract / export_schema 写入变量池
 * @param {import('../runOrchestrator').ExecutionContext} ctx
 * @param {number} templateId
 * @param {object} [inputParams]
 * @param {object} [options]
 */
async function runDetPreflight(ctx, templateId, inputParams = {}, options = {}) {
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

  if (!preflight.length) {
    // 无 preflight_steps 时仍可从主请求获取变量
  }

  for (const field of tpl.export_schema || []) {
    if (!field?.key) continue;
    const lastHttp = [ ...steps ].reverse().find(s => s.artifacts?.http?.body);
    if (lastHttp?.artifacts?.http?.body && field.json_path) {
      applyExtract(vars, lastHttp.artifacts.http.body, {
        [field.key]: normalizeExportJsonPath(field.json_path),
      });
    }
  }

  if (shouldRunTemplateMain(tpl, vars, options)) {
    const main = await runTemplateMainRequest(ctx, tpl, vars, steps, inputParams);
    if (!main.ok) {
      return { ok: false, vars, template: tpl, steps, failedStep: main.sub };
    }
  }

  return { ok: true, vars, template: tpl, steps };
}

module.exports = {
  runDetPreflight,
  collectPlaceholders,
  missingPlaceholders,
  normalizeExportJsonPath,
};
