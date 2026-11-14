'use strict';

const { presentError } = require('../lib/httpError');

function isApiBody(body) {
  return !!body && typeof body === 'object' && !Buffer.isBuffer(body) && Object.prototype.hasOwnProperty.call(body, 'code');
}

function relaxServerTimeout(ctx) {
  const server = ctx.req?.socket?.server;
  const longWait = 6 * 60 * 60 * 1000 + 15 * 60 * 1000;
  if (!server || server.requestTimeout >= longWait) return;
  server.requestTimeout = longWait;
  server.timeout = 0;
}

module.exports = () => {
  return async function apiError(ctx, next) {
    relaxServerTimeout(ctx);
    try {
      await next();
      if (ctx.status === 404 && !isApiBody(ctx.body)) {
        ctx.set('content-type', 'application/json; charset=utf-8');
        ctx.body = { code: 404, message: '接口不存在', data: null, error_code: 'NOT_FOUND' };
      }
    } catch (err) {
      const body = presentError(err);
      ctx.status = body.code;
      ctx.set('content-type', 'application/json; charset=utf-8');
      ctx.body = body;
      ctx.logger.error(
        '[cartoon] %s %s %s %s',
        ctx.method,
        ctx.path,
        body.error_code || '',
        err?.stack || err?.message,
      );
    }
  };
};
