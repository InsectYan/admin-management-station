'use strict';

const { emitProgress } = require('../../../lib/fitnessRunEvents');
const BaseTsEngine = require('./baseTsEngine');
const { executeMatrixRow } = require('../runners/matrixRowRunner');
const { applyExtract, applyVarsToRow } = require('../runners/varPool');

class Ts05ChainEngine extends BaseTsEngine {
  constructor() {
    super('TS-05-CHAIN');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { runConfig, run, ctx: eggCtx, item } = ctx;
    const steps = runConfig?.config_json?.steps;
    if (!Array.isArray(steps) || !steps.length) {
      const err = new Error('TS-05-CHAIN 需要 config_json.steps 非空');
      err.status = 400;
      err.code = 'CHAIN_STEPS_REQUIRED';
      throw err;
    }

    /** @type {Record<string, unknown>} */
    const vars = { ...(runConfig?.config_json?.vars || {}) };
    const results = [];
    let passCount = 0;
    const total = steps.length;
    const runId = run.id;

    for (let i = 0; i < steps.length; i += 1) {
      const rawStep = steps[i];
      const row = applyVarsToRow(rawStep, vars);
      const sub = await executeMatrixRow(ctx, row, i);

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
        const sub = await executeMatrixRow(ctx, row, results.length);
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
