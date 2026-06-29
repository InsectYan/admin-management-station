'use strict';

/**
 * @typedef {object} SubRunResult
 * @property {number} sub_index
 * @property {string} [input_summary]
 * @property {string} [output_summary]
 * @property {object} [assertion_detail]
 * @property {string} [sub_verdict]
 * @property {object} [artifacts]
 */

class BaseTsEngine {
  /** @param {string} schemeId */
  constructor(schemeId) {
    this.schemeId = schemeId;
  }

  /** @param {import('./runOrchestrator').ExecutionContext} _ctx */
  async execute(_ctx) {
    throw new Error(`TS engine ${this.schemeId} not implemented`);
  }
}

module.exports = BaseTsEngine;
