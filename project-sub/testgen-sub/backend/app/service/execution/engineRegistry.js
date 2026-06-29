'use strict';

const Ts01DetEngine = require('./engines/ts01DetEngine');
const Ts02BndEngine = require('./engines/ts02BndEngine');
const Ts03RepEngine = require('./engines/ts03RepEngine');
const Ts04SetEngine = require('./engines/ts04SetEngine');
const Ts05ChainEngine = require('./engines/ts05ChainEngine');
const Ts06PairEngine = require('./engines/ts06PairEngine');
const Ts07NegEngine = require('./engines/ts07NegEngine');
const Ts08ObsEngine = require('./engines/ts08ObsEngine');
const Ts10ManEngine = require('./engines/ts10ManEngine');

/** @type {Map<string, import('./engines/baseTsEngine')>} */
const engines = new Map([
  [ 'TS-01-DET', new Ts01DetEngine() ],
  [ 'TS-02-BND', new Ts02BndEngine() ],
  [ 'TS-03-REP', new Ts03RepEngine() ],
  [ 'TS-04-SET', new Ts04SetEngine() ],
  [ 'TS-05-CHAIN', new Ts05ChainEngine() ],
  [ 'TS-06-PAIR', new Ts06PairEngine() ],
  [ 'TS-07-NEG', new Ts07NegEngine() ],
  [ 'TS-08-OBS', new Ts08ObsEngine() ],
  [ 'TS-10-MAN', new Ts10ManEngine() ],
]);

function isLaunchable(schemeId) {
  return engines.has(schemeId);
}

function launchableSchemeIds() {
  return [ ...engines.keys() ];
}

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

module.exports = { get, engines, isLaunchable, launchableSchemeIds };
