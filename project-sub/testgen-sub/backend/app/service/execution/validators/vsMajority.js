'use strict';

const BaseVsEngine = require('./baseVsEngine');

class VsMajorityEngine extends BaseVsEngine {
  constructor() {
    super('VS-11-MAJORITY');
  }

  /** @param {import('../runOrchestrator').SubRunResult[]} subResults */
  async judge(subResults, thresholdJson, _item, validationId) {
    const reviewerCount = Number(thresholdJson?.reviewer_count) || 1;
    const majorityRule = String(thresholdJson?.majority_rule || '>50%');
    const minPass = majorityRule.includes('50')
      ? Math.ceil(reviewerCount / 2)
      : reviewerCount;

    const reviews = (subResults || []).flatMap(sub => {
      const detail = sub.assertion_detail;
      if (!Array.isArray(detail)) return [];
      return detail.filter(d => d.type === 'human_review' || d.type === 'agent_judge');
    });

    const passVotes = reviews.filter(r => r.pass === true || r.ok === true).length;
    const pass = passVotes >= minPass;

    return {
      pass,
      verdict: pass ? 'pass' : 'fail',
      reviewer_count: reviewerCount,
      pass_votes: passVotes,
      min_pass: minPass,
      details: [{
        type: 'majority',
        ok: pass,
        message: pass
          ? `多数通过 ${passVotes}/${reviewerCount}`
          : `未达多数 ${passVotes}/${reviewerCount}（需 ≥${minPass}）`,
      }],
    };
  }
}

module.exports = VsMajorityEngine;
