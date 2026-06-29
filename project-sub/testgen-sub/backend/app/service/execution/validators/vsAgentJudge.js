'use strict';

const BaseVsEngine = require('./baseVsEngine');
const VsRateEngine = require('./vsRate');
const VsPassKEngine = require('./vsPassK');
const { AgentHookRunner } = require('../agentHook');

const rateEngine = new VsRateEngine();
const passKEngine = new VsPassKEngine();

class VsAgentJudgeEngine extends BaseVsEngine {
  constructor() {
    super('VS-AGENT');
  }

  /**
   * @param {import('../runOrchestrator').SubRunResult[]} subResults
   * @param {object} [execCtx]
   */
  async judge(subResults, thresholdJson, item, validationId, execCtx) {
    const runConfig = execCtx?.runConfig;
    const cfg = runConfig?.config_json || {};
    const ctx = execCtx?.ctx;

    if (ctx && cfg.use_agent_judge !== false) {
      const hookRunner = new AgentHookRunner(ctx);
      const needsJudge = subResults.some(
        sub => !(Array.isArray(sub.assertion_detail)
          && sub.assertion_detail.some(d => d.type === 'agent_judge')),
      );
      if (needsJudge) {
        await hookRunner.applyPostSubRunJudge(execCtx, subResults);
      }
    }

    const vid = String(validationId || '');
    if (vid.startsWith('VS-07') || vid.includes('RATE')) {
      return rateEngine.judge(subResults, thresholdJson, item, validationId);
    }
    if (vid.startsWith('VS-08') || vid.includes('PASSK')) {
      return passKEngine.judge(subResults, thresholdJson, item, validationId);
    }

    const passCount = (subResults || []).filter(s => s.sub_verdict === 'pass').length;
    const total = subResults?.length || 0;
    const pass = total > 0 && passCount === total;
    return {
      pass,
      verdict: pass ? 'pass' : 'fail',
      pass_count: passCount,
      details: [{
        type: 'agent_aggregate',
        ok: pass,
        message: pass ? '全部 Agent 判定通过' : `${total - passCount}/${total} 子项未通过`,
      }],
    };
  }
}

module.exports = VsAgentJudgeEngine;
