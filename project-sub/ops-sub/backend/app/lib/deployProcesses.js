'use strict';

const children = new Map();

function track(jobId, child) {
  children.set(Number(jobId), child);
}

function untrack(jobId) {
  children.delete(Number(jobId));
}

function kill(jobId) {
  const child = children.get(Number(jobId));
  if (!child || child.killed) return false;
  child.kill('SIGTERM');
  setTimeout(() => {
    if (!child.killed && child.exitCode == null) child.kill('SIGKILL');
  }, 2000);
  return true;
}

module.exports = { track, untrack, kill };
