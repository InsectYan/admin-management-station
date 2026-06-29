'use strict';

const VsContractEngine = require('./validators/vsContract');

const contractEngine = new VsContractEngine();

/** VS 分组与 VS-02 契约判定（E1 默认走契约引擎） */
const CONTRACT_IDS = new Set([
  'VS-02-CONTRACT',
  'VS-01-EXACT',
]);

function get(validationId) {
  if (!validationId || CONTRACT_IDS.has(validationId) || String(validationId).startsWith('VS-02')) {
    return contractEngine;
  }
  const err = new Error(`判定引擎尚未实现: ${validationId}`);
  err.status = 501;
  err.code = 'VS_NOT_IMPLEMENTED';
  throw err;
}

module.exports = { get };
