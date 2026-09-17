'use strict';

const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(200);

function jobChannel(jobId) {
  return `job:${jobId}`;
}

function emitJobEvent(jobId, event, payload) {
  bus.emit(jobChannel(jobId), { event, payload });
}

function onJobEvent(jobId, handler) {
  const channel = jobChannel(jobId);
  bus.on(channel, handler);
  return () => bus.off(channel, handler);
}

module.exports = { emitJobEvent, onJobEvent };
