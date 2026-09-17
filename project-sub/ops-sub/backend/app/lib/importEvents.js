'use strict';

const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(200);

function channel(jobId) {
  return `import:${jobId}`;
}

function emitImportEvent(jobId, event, payload) {
  bus.emit(channel(jobId), { event, payload });
}

function onImportEvent(jobId, handler) {
  const name = channel(jobId);
  bus.on(name, handler);
  return () => bus.off(name, handler);
}

module.exports = { emitImportEvent, onImportEvent };
