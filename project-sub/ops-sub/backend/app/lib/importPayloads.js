'use strict';

const payloads = new Map();

function stashImportPayload(jobId, doc) {
  payloads.set(Number(jobId), doc);
}

function takeImportPayload(jobId) {
  const id = Number(jobId);
  const doc = payloads.get(id);
  payloads.delete(id);
  return doc;
}

module.exports = { stashImportPayload, takeImportPayload };
