'use strict';

const { randomUUID } = require('crypto');
const { emitProgress } = require('../../../lib/fitnessRunEvents');
const BaseTsEngine = require('./baseTsEngine');
const { executeMatrixRow } = require('../runners/matrixRowRunner');
const { applyExtract, applyVarsToRow } = require('../runners/varPool');
const { executeApiTemplateContext } = require('../runners/apiTemplateContextRunner');
const { splitApiCtxResults } = require('../../../lib/apiCtxContent');

class Ts05ChainEngine extends BaseTsEngine {
  constructor() {
    super('TS-05-CHAIN');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { runConfig, run } = ctx;
    const schemeId = run?.scheme_id || ctx.item?.scheme_primary_id;
    const cfgMode = runConfig?.config_json?.execution_mode;
    const mode = cfgMode || (schemeId === 'TS-05-API' ? 'api_ctx' : 'chain');
    if (mode === 'api_ctx') {
      return this.executeApiCtx(ctx);
    }
    return this.executeChain(ctx);
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async executeApiCtx(ctx) {
    const { runConfig, run, ctx: eggCtx } = ctx;
    const configJson = runConfig?.config_json || {};
    const apiTemplateId = runConfig?.api_template_id || configJson.api_template_id;

    if (!apiTemplateId) {
      const err = new Error('TPL-API-CTX 需要选择接口模板 api_template_id');
      err.status = 400;
      err.code = 'API_TEMPLATE_REQUIRED';
      throw err;
    }

    const template = await eggCtx.model.FtApiTemplate.findByPk(apiTemplateId);
    if (!template || !template.is_active) {
      const err = new Error(`接口模板 #${apiTemplateId} 不存在或已停用`);
      err.status = 400;
      err.code = 'API_TEMPLATE_NOT_FOUND';
      throw err;
    }

    const bindings = runConfig?.inject_bindings || configJson.inject_bindings || {};
    const inputParams = configJson.input_params || {};
    let sampleRows = [];

    const sampleBinding = Object.values(bindings).find(b => b?.mode === 'sample_set' && b.sample_set_id);
    if (sampleBinding?.sample_set_id) {
      sampleRows = await eggCtx.model.FtSampleItem.findAll({
        where: { sample_set_id: sampleBinding.sample_set_id },
        order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
      });
    }

    const runId = run.id;
    const results = await executeApiTemplateContext(ctx, template, {
      inputParams,
      injectBindings: bindings,
      sampleRows: sampleRows.map(r => r.toJSON()),
    });

    const { preflight, content, preflightOk } = splitApiCtxResults(results);
    if (runId) {
      const passCount = content.filter(r => r.sub_verdict === 'pass').length;
      emitProgress(runId, {
        phase: 'running',
        percent: 69,
        pass_rate: content.length
          ? Math.round((passCount / content.length) * 1000) / 10
          : 0,
        completed: content.length,
        total: content.length,
        preflight_ok: preflightOk,
        preflight_checks: preflight.map(r => ({
          sub_index: r.sub_index,
          step_name: r.step_name || r.output_summary,
          sub_verdict: r.sub_verdict,
          output_summary: r.output_summary,
        })),
        run_id: runId,
      });
    }

    return results;
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async executeChain(ctx) {
    const { runConfig, run, ctx: eggCtx, item } = ctx;
    const steps = runConfig?.config_json?.steps;
    if (!Array.isArray(steps) || !steps.length) {
      const err = new Error('TS-05-CHAIN 需要 config_json.steps 非空');
      err.status = 400;
      err.code = 'CHAIN_STEPS_REQUIRED';
      throw err;
    }

    /** @type {Record<string, unknown>} */
    const vars = {
      uuid: randomUUID(),
      ...(ctx.globalRequestContext?.vars || {}),
      ...(runConfig?.config_json?.vars || {}),
    };
    const results = [];
    let passCount = 0;
    const total = steps.length;
    const runId = run.id;
    let globalStepIndex = 0;

    for (let i = 0; i < steps.length; i += 1) {
      const rawStep = steps[i];
      const row = applyVarsToRow(rawStep, vars);
      const sub = await executeMatrixRow(ctx, row, i, {
        step_index: globalStepIndex,
        source: 'config',
        step_name: rawStep.name || rawStep.path || `config-step-${i + 1}`,
      });
      globalStepIndex += 1;

      if (sub.artifacts?.http?.body && rawStep.extract) {
        applyExtract(vars, sub.artifacts.http.body, rawStep.extract);
        sub.artifacts.vars = { ...vars };
      }

      results.push(sub);
      if (sub.sub_verdict === 'pass') passCount += 1;

      if (runId) {
        emitProgress(runId, {
          phase: 'running',
          percent: Math.min(69, Math.round(20 + ((i + 1) / total) * 50)),
          pass_rate: Math.round((passCount / (i + 1)) * 1000) / 10,
          completed: i + 1,
          total,
          run_id: runId,
        });
      }

      if (sub.sub_verdict !== 'pass' && rawStep.stop_on_fail !== false) {
        break;
      }
    }

    const exploreHook = runConfig?.config_json?.agent_hook;
    const exploreEnabled = exploreHook === 'explore'
      || (typeof exploreHook === 'object' && exploreHook?.explore);
    if (exploreEnabled && eggCtx) {
      const { AgentHookRunner } = require('../agentHook');
      const hookRunner = new AgentHookRunner(eggCtx);
      const maxSteps = Number(runConfig?.config_json?.max_explore_steps) || 5;
      const goal = runConfig?.config_json?.explore_goal || item?.expected_observation || '';
      /** @type {object[]} */
      const history = results.map(r => ({
        input: r.input_summary,
        output: r.output_summary,
        verdict: r.sub_verdict,
      }));

      for (let e = 0; e < maxSteps; e += 1) {
        const plan = await hookRunner.planExploreStep(ctx, history, goal);
        if (!plan || plan.done) break;
        const row = applyVarsToRow(plan.step || plan, vars);
        const sub = await executeMatrixRow(ctx, row, results.length, {
          step_index: globalStepIndex,
          source: 'explore',
          step_name: (plan.step || plan).name || `explore-step-${e + 1}`,
        });
        globalStepIndex += 1;
        if (sub.artifacts?.http?.body && (plan.step || plan).extract) {
          applyExtract(vars, sub.artifacts.http.body, (plan.step || plan).extract);
        }
        results.push(sub);
        history.push({
          input: sub.input_summary,
          output: sub.output_summary,
          verdict: sub.sub_verdict,
        });
        if (sub.sub_verdict !== 'pass' && (plan.step || plan).stop_on_fail !== false) break;
      }
    }

    return results;
  }
}

module.exports = Ts05ChainEngine;
