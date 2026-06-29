'use strict';

const BaseTsEngine = require('./baseTsEngine');

class Ts10ManEngine extends BaseTsEngine {
  constructor() {
    super('TS-10-MAN');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { item, runConfig, run } = ctx;
    const cfg = runConfig?.config_json || {};

    return [{
      sub_index: 0,
      input_summary: `人工评审: ${item.title || item.item_id}`,
      output_summary: '待评审材料已就绪',
      sub_verdict: 'pending',
      assertion_detail: [{
        type: 'manual_queue',
        status: 'pending_review',
        rubric_id: cfg.rubric_id || 'consult_quality_v1',
        materials: {
          expected_observation: item.expected_observation,
          test_input_example: item.test_input_example,
          execution_note: item.execution_note,
        },
      }],
      artifacts: {
        manual: true,
        run_id: run.id,
        item_id: item.item_id,
      },
    }];
  }
}

module.exports = Ts10ManEngine;
