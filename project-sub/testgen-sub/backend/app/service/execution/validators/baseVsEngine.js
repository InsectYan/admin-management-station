'use strict';

class BaseVsEngine {
  /** @param {string} validationId */
  constructor(validationId) {
    this.validationId = validationId;
  }

  /** @param {import('./runOrchestrator').SubRunResult[]} _subResults */
  async judge(_subResults, _thresholdJson, _item) {
    throw new Error(`VS engine ${this.validationId} not implemented`);
  }
}

module.exports = BaseVsEngine;
