'use strict';

function bucket(app) {
  if (!app.cartoonRuns) app.cartoonRuns = new Map();
  return app.cartoonRuns;
}

function keyOf(projectId, kind, targetId) {
  return `${projectId}:${kind}:${targetId}`;
}

function present(row) {
  return {
    kind: row.kind,
    target_id: row.targetId,
    started_at: row.startedAt,
  };
}

function begin(app, fields) {
  const projectId = Number(fields.projectId);
  const targetId = Number(fields.targetId);
  const key = keyOf(projectId, fields.kind, targetId);
  const map = bucket(app);
  const current = map.get(key);
  if (current && current.status === 'running') {
    return { joined: true, done: current.done };
  }
  let resolve;
  let reject;
  const done = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  done.catch(() => {});
  const controller = new AbortController();
  const row = {
    key,
    projectId,
    kind: fields.kind,
    targetId,
    status: 'running',
    startedAt: Date.now(),
    controller,
    done,
    resolve,
    reject,
  };
  map.set(key, row);
  return { joined: false, signal: controller.signal, row };
}

function finish(app, row, error, result) {
  if (!row || row.status !== 'running') return;
  row.status = error ? 'failed' : 'done';
  row.finishedAt = Date.now();
  if (error) row.reject(error);
  else row.resolve(result);
  setTimeout(() => {
    const map = bucket(app);
    if (map.get(row.key) === row) map.delete(row.key);
  }, 20000);
}

function list(app, projectId) {
  return [ ...bucket(app).values() ]
    .filter(row => String(row.projectId) === String(projectId) && row.status === 'running')
    .map(present);
}

function cancelProject(app, projectId) {
  let count = 0;
  for (const row of bucket(app).values()) {
    if (String(row.projectId) !== String(projectId) || row.status !== 'running') continue;
    row.controller.abort();
    count += 1;
  }
  return count;
}

module.exports = { begin, finish, list, cancelProject };
