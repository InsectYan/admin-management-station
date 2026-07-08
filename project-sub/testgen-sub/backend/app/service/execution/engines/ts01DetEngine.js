'use strict';

const BaseTsEngine = require('./baseTsEngine');
const { resolveHttpBody, methodNeedsBody } = require('../../../lib/httpRequestBody');
const { renderApiTemplateCases } = require('../../../lib/apiTemplateRender');
const { runCli } = require('../runners/cliRunner');
const { runHttp } = require('../runners/httpRunner');

class Ts01DetEngine extends BaseTsEngine {
  constructor() {
    super('TS-01-DET');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { item, env, run, runConfig, ctx: eggCtx } = ctx;
    const configJson = runConfig?.config_json || {};

    if (item.automation_command) {
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
    if (useApiTemplate && apiTemplateId && env?.bff_coach_url) {
      return this._executeApiTemplate(ctx, {
        apiTemplateId,
        bindings: runConfig?.inject_bindings || configJson.inject_bindings || {},
        configJson,
      });
    }

    if (item.endpoint_path && env?.bff_coach_url) {
      const headers = {
        'X-Test-Run-Id': String(run.id),
        'X-Test-Item-Id': item.item_id,
        ...(configJson.headers || {}),
      };
      const method = (
        item.http_method || configJson.method || configJson.http_method || 'GET'
      ).toUpperCase();
      const body = methodNeedsBody(method) ? resolveHttpBody(method, configJson) : undefined;
      const httpResult = await runHttp(ctx.ctx, {
        baseUrl: env.bff_coach_url,
        path: item.endpoint_path,
        method,
        headers,
        body,
      });
      const assertions = configJson.assertions || [];
      if (!assertions.length && item.http_status_expected != null) {
        assertions.push({ type: 'status', expect: item.http_status_expected });
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
        artifacts: { http: httpResult },
      }];
    }

    const err = new Error('用例既无 automation_command 也无 endpoint_path，无法执行 TS-01-DET');
    err.status = 400;
    err.code = 'RUNNER_NOT_AVAILABLE';
    throw err;
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
    const casePlans = renderApiTemplateCases(tplJson, bindings, sampleRows, configJson.vars || {});
    const expectStatus = configJson.http_status_expected ?? item.http_status_expected ?? 200;
    const results = [];

    for (let i = 0; i < casePlans.length; i += 1) {
      const req = casePlans[i].request;
      const headers = {
        'X-Test-Run-Id': String(run.id),
        'X-Test-Item-Id': item.item_id,
        ...(configJson.headers || {}),
        ...(req.headers || {}),
      };
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
