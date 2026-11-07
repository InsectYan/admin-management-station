'use strict';

function clientAbort(ctx) {
  const controller = new AbortController();
  const onClose = () => {
    if (!ctx.res.writableEnded) controller.abort();
  };
  ctx.req.on('close', onClose);
  return {
    signal: controller.signal,
    stopped() {
      return controller.signal.aborted;
    },
    release() {
      ctx.req.off('close', onClose);
    },
  };
}

function stopError() {
  const err = new Error('已停止');
  err.status = 499;
  return err;
}

module.exports = { clientAbort, stopError };
