'use strict';

const { extractResponseText } = require('../../lib/apiCtxContent');

const FIELD_MAX = 2048;

/** @param {unknown} value @param {number} [max] */
function truncate(value, max = FIELD_MAX) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * @param {import('./runOrchestrator').SubRunResult} sub
 * @param {object} item
 */
function buildObservation(sub, item) {
  const http = sub.artifacts?.http;
  let responseExcerpt = '';
  if (http?.body != null) {
    responseExcerpt = truncate(
      typeof http.body === 'string' ? http.body : JSON.stringify(http.body),
    );
  } else if (sub.output_summary) {
    responseExcerpt = truncate(sub.output_summary);
  }

  return {
    sub_run_index: sub.sub_index,
    http_status: http?.statusCode ?? null,
    response_excerpt: responseExcerpt,
    journey_summary: sub.artifacts?.journey || null,
    expected_hint: item?.expected_observation || item?.expected_result || '',
    input_summary: sub.input_summary || '',
  };
}

/**
 * @param {object} configJson
 */
function parseAgentHook(configJson) {
  const raw = configJson?.agent_hook;
  if (!raw) return {};
  if (typeof raw === 'string') {
    return { explore: raw };
  }
  return raw;
}

/**
 * @param {string} hookValue e.g. "fitness-sample-skill:from_example"
 */
function parseHookRef(hookValue) {
  if (!hookValue || typeof hookValue !== 'string') return null;
  const [ skill, action ] = hookValue.split(':');
  if (!skill || !action) return null;
  return { skill, action };
}

class AgentHookRunner {
  /** @param {import('egg').Context} ctx */
  constructor(ctx) {
    this.ctx = ctx;
  }

  shouldApplyAgentJudge(runConfig) {
    const cfg = runConfig?.config_json || {};
    if (cfg.execution_mode === 'api_ctx') return false;
    if (cfg.use_agent_judge === true) return true;
    const hook = parseAgentHook(cfg);
    return Boolean(hook.post_sub_run || hook.vs_agent);
  }

  shouldApplyApiCtxContentJudge(runConfig) {
    const cfg = runConfig?.config_json || {};
    return cfg.execution_mode === 'api_ctx' && cfg.use_agent_judge !== false;
  }

  /**
   * @param {import('./runOrchestrator').ExecutionContext} execCtx
   * @param {import('./runOrchestrator').SubRunResult[]} subResults
   */
  async applyPostSubRunJudge(execCtx, subResults) {
    const { runConfig, item, run } = execCtx;
    const cfg = runConfig?.config_json || {};
    const hook = parseAgentHook(cfg);
    const rubricId = cfg.rubric_id || 'consult_quality_v1';
    const trace = {
      run_id: run?.id,
      item_id: item?.item_id,
    };

    for (const sub of subResults) {
      const observation = buildObservation(sub, item);
      try {
        const agentRes = await this.ctx.service.agentProxy.invokeFitnessJudge({
          action: 'judge',
          rubric_id: rubricId,
          observations: [ observation ],
          threshold_json: runConfig?.threshold_json || {},
          trace,
        });
        const judge = agentRes.output?.judge || agentRes.output || {};
        const pass = judge.pass === true;
        sub.sub_verdict = pass ? 'pass' : 'fail';
        const detail = Array.isArray(sub.assertion_detail) ? sub.assertion_detail : [];
        sub.assertion_detail = [
          ...detail,
          {
            type: 'agent_judge',
            ok: pass,
            pass,
            score: judge.score,
            reasons: judge.reasons || [],
            rubric_id: rubricId,
            hook: hook.post_sub_run || 'use_agent_judge',
          },
        ];
      } catch (err) {
        sub.sub_verdict = 'fail';
        const detail = Array.isArray(sub.assertion_detail) ? sub.assertion_detail : [];
        sub.assertion_detail = [
          ...detail,
          {
            type: 'agent_judge',
            ok: false,
            pass: false,
            pending_judge: true,
            error: err.message,
            rubric_id: rubricId,
          },
        ];
        this.ctx.app.logger.warn(
          '[agentHook] judge failed run=%s sub=%s %s',
          run?.id,
          sub.sub_index,
          err.message,
        );
      }
    }

    return subResults;
  }

  /**
   * TPL-API-CTX：功能性通过后，用 Agent 比对响应文案与用例 expected_observation
   * @param {import('./runOrchestrator').ExecutionContext} execCtx
   * @param {import('./runOrchestrator').SubRunResult[]} contentSubs
   * @param {object} [apiTemplate]
   */
  async applyApiCtxContentJudge(execCtx, contentSubs, apiTemplate = {}) {
    const { runConfig, item, run } = execCtx;
    const expected = item?.expected_observation
      || (Array.isArray(item?.assertion_points) ? item.assertion_points[0] : '')
      || '';
    const extractPaths = apiTemplate?.content_extract_paths;
    const trace = { run_id: run?.id, item_id: item?.item_id };

    for (const sub of contentSubs) {
      if (sub.functional_verdict !== 'pass') {
        const detail = Array.isArray(sub.assertion_detail) ? sub.assertion_detail : [];
        sub.assertion_detail = [
          ...detail,
          {
            type: 'content_skipped',
            ok: false,
            message: '接口功能性未通过，跳过内容观测比对',
          },
        ];
        continue;
      }

      const body = sub.artifacts?.http?.body;
      const actualText = extractResponseText(body, extractPaths);
      sub.artifacts = {
        ...(sub.artifacts || {}),
        content_text: actualText,
      };

      try {
        const agentRes = await this.ctx.service.agentProxy.invokeObservationMatch({
          action: 'match',
          expected_observation: expected,
          actual_text: actualText,
          input_summary: sub.input_summary || '',
          threshold_json: runConfig?.threshold_json || {},
          trace,
        });
        const match = agentRes.output?.match || agentRes.output || {};
        const pass = match.pass === true;
        sub.sub_verdict = pass ? 'pass' : 'fail';
        const detail = Array.isArray(sub.assertion_detail) ? sub.assertion_detail : [];
        sub.assertion_detail = [
          ...detail,
          {
            type: 'observation_match',
            ok: pass,
            pass,
            score: match.score,
            reasons: match.reasons || [],
            expected_observation: expected,
            actual_excerpt: truncate(actualText, 500),
            fallback: match.fallback === true,
          },
        ];
      } catch (err) {
        sub.sub_verdict = 'fail';
        const detail = Array.isArray(sub.assertion_detail) ? sub.assertion_detail : [];
        sub.assertion_detail = [
          ...detail,
          {
            type: 'observation_match',
            ok: false,
            pass: false,
            pending_judge: true,
            error: err.message,
            expected_observation: expected,
            actual_excerpt: truncate(actualText, 500),
          },
        ];
        this.ctx.app.logger.warn(
          '[agentHook] observation match failed run=%s sub=%s %s',
          run?.id,
          sub.sub_index,
          err.message,
        );
      }
    }

    return contentSubs;
  }

  /**
   * @param {import('./runOrchestrator').ExecutionContext} execCtx
   */
  async runPreExecute(execCtx) {
    const cfg = execCtx.runConfig?.config_json || {};
    const hook = parseAgentHook(cfg);
    const ref = parseHookRef(hook.pre_execute);
    if (!ref) return execCtx;

    if (ref.skill === 'fitness-sample-skill') {
      const agentRes = await this.ctx.service.agentProxy.invokeFitnessSample({
        action: ref.action,
        item_id: execCtx.item?.item_id,
        scheme_id: execCtx.run?.scheme_id || execCtx.item?.scheme_primary_id,
        test_input_example: execCtx.item?.test_input_example,
        sample_set_id: execCtx.runConfig?.sample_set_id,
        trace: { run_id: execCtx.run?.id, item_id: execCtx.item?.item_id },
      });
      const samples = agentRes.output?.samples || agentRes.output?.items || [];
      if (samples.length && execCtx.runConfig?.sample_set_id) {
        await this.ctx.service.internalFitness.bulkCreateSampleItems({
          sample_set_id: execCtx.runConfig.sample_set_id,
          items: samples,
        });
      }
    }

    return execCtx;
  }

  /**
   * @param {import('./runOrchestrator').ExecutionContext} execCtx
   * @param {object[]} history
   * @param {string} goal
   */
  async planExploreStep(execCtx, history, goal) {
    const cfg = execCtx.runConfig?.config_json || {};
    const maxSteps = Number(cfg.max_explore_steps) || 5;
    const agentRes = await this.ctx.service.agentProxy.invokeFitnessExplore({
      action: 'plan',
      history,
      goal: goal || execCtx.item?.expected_observation || '',
      max_explore_steps: maxSteps,
      trace: { run_id: execCtx.run?.id, item_id: execCtx.item?.item_id },
    });
    return agentRes.output?.step || agentRes.output || null;
  }
}

module.exports = {
  AgentHookRunner,
  buildObservation,
  parseAgentHook,
  parseHookRef,
  truncate,
};
