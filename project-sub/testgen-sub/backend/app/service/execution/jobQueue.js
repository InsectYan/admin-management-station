'use strict';

let active = 0;
/** @type {Array<() => Promise<void>>} */
const queue = [];

/**
 * @param {import('egg').Application} app
 * @param {() => Promise<void>} task
 */
function enqueue(app, task) {
  queue.push(task);
  drain(app);
}

function drain(app) {
  const max = app.config.fitnessExecution?.maxConcurrentRuns || 3;
  while (active < max && queue.length) {
    const task = queue.shift();
    active += 1;
    Promise.resolve()
      .then(task)
      .catch(err => {
        app.logger.error('[fitnessJobQueue] %s', err.message);
      })
      .finally(() => {
        active -= 1;
        drain(app);
      });
  }
}

module.exports = { enqueue };
