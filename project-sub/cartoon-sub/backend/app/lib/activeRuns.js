'use strict';

function bucket(app) {
  if (!app.cartoonRuns) app.cartoonRuns = new Map();
  return app.cartoonRuns;
}

function keyOf(projectId, kind, targetId) {
  return `${projectId}:${kind}:${targetId}`;
}

function notePace(row, chars, label) {
  if (!row || row.status !== 'running') return;
  const count = Math.max(0, Number(chars) || 0);
  const now = Date.now();
  if (count < (Number(row.chars) || 0)) {
    row.paceMark = { t: now, chars: 0 };
    row.charsPerSec = 0;
  }
  row.chars = count;
  if (label) row.label = String(label).slice(0, 40);
  if (!row.paceMark) row.paceMark = { t: row.startedAt || now, chars: 0 };
  const dt = now - row.paceMark.t;
  if (dt < 700) return;
  const dc = count - row.paceMark.chars;
  row.charsPerSec = dc > 0 ? Math.max(1, Math.round(dc / (dt / 1000))) : 0;
  row.paceMark = { t: now, chars: count };
}

function present(row) {
  return {
    kind: row.kind,
    target_id: row.targetId,
    started_at: row.startedAt,
    label: row.label || '',
    chars: Number(row.chars) || 0,
    chars_per_sec: Number(row.charsPerSec) || 0,
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

module.exports = { begin, finish, list, cancelProject, notePace };
