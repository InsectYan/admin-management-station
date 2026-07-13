'use strict';

const BaseTsEngine = require('./baseTsEngine');
const { resolveHttpBody, methodNeedsBody } = require('../../../lib/httpRequestBody');
const { resolveDetHttpTarget, inferHttpFields } = require('../../../lib/inferHttpFields');
const { renderApiTemplateCases } = require('../../../lib/apiTemplateRender');
const { mergeRequestHeaders } = require('../../../lib/globalRequestContext');
const { applyVarsToRow } = require('../runners/varPool');
const { runCli } = require('../runners/cliRunner');
const { runHttp } = require('../runners/httpRunner');
const { runDetPreflight } = require('../runners/detPreflightRunner');

class Ts01DetEngine extends BaseTsEngine {
  constructor() {
    super('TS-01-DET');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { item, env, run, runConfig, ctx: eggCtx } = ctx;
    const configJson = runConfig?.config_json || {};

    if (item.automation_command || configJson.execution_mode === 'cli') {
      const cliResult = await runCli(ctx.ctx, {
        command: item.automation_command,
        env,
      });
      const outputTail = (cliResult.stdout || cliResult.stderr || '').slice(-2000);
      return [{
        sub_index: 0,
        input_summary: cliResult.command,
        output_summary: `exit=${cliResult.exitCode} (${cliResult.durationMs}ms)`,
        assertion_detail: {
          runner: 'cli',
          exit_code: cliResult.exitCode,
          duration_ms: cliResult.durationMs,
          stdout_tail: cliResult.stdout?.slice(-1500),
          stderr_tail: cliResult.stderr?.slice(-500),
        },
        sub_verdict: cliResult.exitCode === 0 ? 'pass' : 'fail',
        artifacts: { cli: cliResult, output_tail: outputTail },
      }];
    }

    const useApiTemplate = runConfig?.use_api_template || configJson.use_api_template;
    const apiTemplateId = runConfig?.api_template_id || configJson.api_template_id;
    const preflightTemplateId = configJson.preflight_api_template_id || null;

    const enrichedItem = inferHttpFields(item);
    const { path, method, statusExpected } = resolveDetHttpTarget(enrichedItem, configJson);

    // 兼容旧模式：仅关联模板、无手写 path 时走完整模板渲染
    if (useApiTemplate && apiTemplateId && !path && env?.bff_coach_url) {
      return this._executeApiTemplate(ctx, {
        apiTemplateId,
        bindings: runConfig?.inject_bindings || configJson.inject_bindings || {},
        configJson,
      });
    }

    if (!path || !env?.bff_coach_url) {
      const err = new Error(
        '用例既无 automation_command 也无 endpoint_path，无法执行 TS-01-DET。'
        + '请在配置页填写接口请求，或填写 automation_command 执行 CLI。',
      );
      err.status = 400;
      err.code = 'RUNNER_NOT_AVAILABLE';
      throw err;
    }

    let vars = { ...(ctx.globalRequestContext?.vars || {}) };
    const preflightResults = [];

    if (preflightTemplateId) {
      const pf = await runDetPreflight(ctx, preflightTemplateId, configJson.preflight_input_params || {});
      preflightResults.push(...(pf.steps || []));
      if (!pf.ok) {
        return [{
          sub_index: 0,
          phase: 'preflight',
          input_summary: '前置链路',
          output_summary: pf.failedStep?.output_summary || '前置校验失败',
          assertion_detail: pf.failedStep?.assertion_detail || [],
          sub_verdict: 'fail',
          artifacts: { preflight: preflightResults, vars: pf.vars },
        }];
      }
      vars = { ...vars, ...pf.vars };
    }

    const interpolated = applyVarsToRow({
      path,
      method,
      headers: { ...(configJson.headers || {}) },
      body: methodNeedsBody(method) ? resolveHttpBody(method, configJson) : undefined,
    }, vars);

    const headers = mergeRequestHeaders(ctx.globalRequestContext?.headers || {}, {
      'X-Test-Run-Id': String(run.id),
      'X-Test-Item-Id': item.item_id,
      ...(interpolated.headers || {}),
    });

    const httpResult = await runHttp(eggCtx, {
      baseUrl: env.bff_coach_url,
      path: interpolated.path,
      method: interpolated.method || method,
      headers,
      body: interpolated.body,
    });

    const assertions = configJson.assertions || [];
    const expectStatus = statusExpected ?? 200;
    if (!assertions.length) {
      assertions.push({ type: 'status', expect: expectStatus });
    }
    const { passed, details } = await ctx.ctx.service.executionEngine.runAssertions(assertions, {
      statusCode: httpResult.statusCode,
      body: httpResult.body,
      responseTimeMs: httpResult.responseTimeMs,
    });

    return [{
      sub_index: 0,
      input_summary: `${httpResult.method} ${httpResult.url}`,
      output_summary: `HTTP ${httpResult.statusCode} (${httpResult.responseTimeMs}ms)`,
      assertion_detail: details,
      sub_verdict: passed ? 'pass' : 'fail',
      artifacts: {
        http: httpResult,
        preflight: preflightResults.length ? preflightResults : undefined,
        vars: Object.keys(vars).length ? vars : undefined,
        preflight_api_template_id: preflightTemplateId || undefined,
      },
    }];
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async _executeApiTemplate(ctx, { apiTemplateId, bindings, configJson }) {
    const { item, env, run, ctx: eggCtx } = ctx;
    const template = await eggCtx.model.FtApiTemplate.findByPk(apiTemplateId);
    if (!template || !template.is_active) {
      const err = new Error(`接口模板 #${apiTemplateId} 不存在或已停用`);
      err.status = 400;
      err.code = 'API_TEMPLATE_NOT_FOUND';
      throw err;
    }

    let sampleRows = [];
    const sampleSetId = Object.values(bindings || {}).find(b => b?.mode === 'sample_set')?.sample_set_id;
    if (sampleSetId) {
      const items = await eggCtx.model.FtSampleItem.findAll({
        where: { sample_set_id: sampleSetId },
        order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
      });
      sampleRows = items.map(r => r.toJSON());
      if (!sampleRows.length) {
        const err = new Error('注入样本集为空，请添加至少一条样本');
        err.status = 400;
        err.code = 'SAMPLE_SET_EMPTY';
        throw err;
      }
    }

    const tplJson = template.toJSON();
    const casePlans = renderApiTemplateCases(
      tplJson,
      bindings,
      sampleRows,
      { ...(ctx.globalRequestContext?.vars || {}), ...(configJson.vars || {}) },
    );
    const expectStatus = configJson.http_status_expected ?? item.http_status_expected ?? 200;
    const results = [];

    for (let i = 0; i < casePlans.length; i += 1) {
      const req = casePlans[i].request;
      const headers = mergeRequestHeaders(ctx.globalRequestContext?.headers || {}, {
        'X-Test-Run-Id': String(run.id),
        'X-Test-Item-Id': item.item_id,
        ...(configJson.headers || {}),
        ...(req.headers || {}),
      });
      const body = methodNeedsBody(req.method) ? req.body : undefined;
      const httpResult = await runHttp(eggCtx, {
        baseUrl: env.bff_coach_url,
        path: req.path,
        method: req.method,
        headers,
        body,
      });

      const assertions = configJson.assertions || [];
      if (!assertions.length) {
        assertions.push({ type: 'status', expect: expectStatus });
      }
      const { passed, details } = await eggCtx.service.executionEngine.runAssertions(assertions, {
        statusCode: httpResult.statusCode,
        body: httpResult.body,
        responseTimeMs: httpResult.responseTimeMs,
      });

      results.push({
        sub_index: i,
        input_summary: `${httpResult.method} ${httpResult.url}`,
        output_summary: `HTTP ${httpResult.statusCode} (${httpResult.responseTimeMs}ms)`,
        assertion_detail: details,
        sub_verdict: passed ? 'pass' : 'fail',
        artifacts: { http: httpResult, api_template_id: apiTemplateId, inject_index: i },
      });
    }

    return results;
  }
}

module.exports = Ts01DetEngine;
