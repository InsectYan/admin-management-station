'use strict';

const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(100);

/** @type {Map<number, Set<import('stream').Writable>>} */
const clientsByRun = new Map();

function subscribe(runId, stream) {
  const id = Number(runId);
  if (!clientsByRun.has(id)) clientsByRun.set(id, new Set());
  clientsByRun.get(id).add(stream);
  stream.on('close', () => unsubscribe(id, stream));
}

function unsubscribe(runId, stream) {
  const set = clientsByRun.get(Number(runId));
  if (!set) return;
  set.delete(stream);
  if (!set.size) clientsByRun.delete(Number(runId));
}

/**
 * @param {number} runId
 * @param {object} payload
 */
function emitProgress(runId, payload) {
  const id = Number(runId);
  bus.emit(`run:${id}`, payload);
  const set = clientsByRun.get(id);
  if (!set) return;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const stream of set) {
    try {
      stream.write(line);
    } catch {
      /* ignore broken pipe */
    }
  }
}

module.exports = {
  bus,
  subscribe,
  unsubscribe,
  emitProgress,
};
