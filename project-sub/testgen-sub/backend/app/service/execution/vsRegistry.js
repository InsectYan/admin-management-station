'use strict';

const VsContractEngine = require('./validators/vsContract');
const VsRateEngine = require('./validators/vsRate');
const VsPassKEngine = require('./validators/vsPassK');
const VsChainEngine = require('./validators/vsChain');
const VsObsEngine = require('./validators/vsObs');
const VsZeroEngine = require('./validators/vsZero');
const VsBlockRateEngine = require('./validators/vsBlockRate');
const VsAgentJudgeEngine = require('./validators/vsAgentJudge');
const VsMajorityEngine = require('./validators/vsMajority');
const VsSloEngine = require('./validators/vsSlo');

const contractEngine = new VsContractEngine();
const rateEngine = new VsRateEngine();
const passKEngine = new VsPassKEngine();
const chainEngine = new VsChainEngine();
const obsEngine = new VsObsEngine();
const zeroEngine = new VsZeroEngine();
const blockRateEngine = new VsBlockRateEngine();
const agentJudgeEngine = new VsAgentJudgeEngine();
const majorityEngine = new VsMajorityEngine();
const sloEngine = new VsSloEngine();

/** VS 分组与 VS-02 契约判定（E1 默认走契约引擎） */
const CONTRACT_IDS = new Set([
  'VS-01-EXACT',
]);

const ZERO_IDS = new Set([
  'VS-03-ZERO',
]);

const BLOCK_IDS = new Set([
  'VS-09-BLOCK-L',
  'VS-09-BLOCK-M',
  'VS-09-BLOCK-H',
]);

const CONTRACT_EXTRA = new Set([
  'VS-02-CONTRACT',
]);

const RATE_IDS = new Set([
  'VS-07-RATE-L',
  'VS-07-RATE-M',
  'VS-07-RATE-H',
]);

const PASSK_IDS = new Set([
  'VS-08-PASSK',
]);

const CHAIN_IDS = new Set([
  'VS-04-CHAIN-OK',
  'VS-04-CHAIN',
]);

const OBS_IDS = new Set([
  'VS-05-PRESENCE',
  'VS-06-COMPLETE',
]);

const SLO_IDS = new Set([
  'VS-10-SLO-L',
  'VS-10-SLO-M',
  'VS-10-SLO-H',
]);

function get(validationId, runConfig) {
  const cfg = runConfig?.config_json || {};
  if (cfg.use_agent_judge === true) {
    return agentJudgeEngine;
  }
  if (validationId === 'VS-11-MAJORITY' || String(validationId || '').startsWith('VS-11')) {
    return majorityEngine;
  }
  if (!validationId || CONTRACT_IDS.has(validationId) || CONTRACT_EXTRA.has(validationId) || String(validationId).startsWith('VS-02')) {
    return contractEngine;
  }
  if (ZERO_IDS.has(validationId) || String(validationId).startsWith('VS-03')) {
    return zeroEngine;
  }
  if (BLOCK_IDS.has(validationId) || String(validationId).startsWith('VS-09')) {
    return blockRateEngine;
  }
  if (CHAIN_IDS.has(validationId) || String(validationId).startsWith('VS-04')) {
    return chainEngine;
  }
  if (OBS_IDS.has(validationId) || String(validationId).startsWith('VS-05') || String(validationId).startsWith('VS-06')) {
    return obsEngine;
  }
  if (RATE_IDS.has(validationId) || String(validationId).startsWith('VS-07')) {
    return rateEngine;
  }
  if (PASSK_IDS.has(validationId) || String(validationId).startsWith('VS-08')) {
    return passKEngine;
  }
  if (SLO_IDS.has(validationId) || String(validationId).startsWith('VS-10')) {
    return sloEngine;
  }
  const err = new Error(`判定引擎尚未实现: ${validationId}`);
  err.status = 501;
  err.code = 'VS_NOT_IMPLEMENTED';
  throw err;
}

module.exports = { get };
