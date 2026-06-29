'use strict';

const Ts01DetEngine = require('./engines/ts01DetEngine');

/** @type {Map<string, import('./engines/baseTsEngine')>} */
const engines = new Map([
  [ 'TS-01-DET', new Ts01DetEngine() ],
]);

function get(schemeId) {
  const engine = engines.get(schemeId);
  if (!engine) {
    const err = new Error(`方案引擎尚未实现: ${schemeId}`);
    err.status = 501;
    err.code = 'ENGINE_NOT_IMPLEMENTED';
    throw err;
  }
  return engine;
}

module.exports = { get, engines };
