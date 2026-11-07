'use strict';

function causeOf(err) {
  const cause = err?.cause;
  if (!cause || typeof cause !== 'object') return null;
  return cause;
}

function presentError(err) {
  const status = Number(err?.status || err?.statusCode);
  const code = status >= 400 && status < 600 ? status : 500;
  const cause = causeOf(err);
  const errorCode = String(err?.errorCode || cause?.code || '');
  const causeMessage = cause?.message && cause.message !== err?.message ? String(cause.message) : '';
  const detail = String(err?.detail || '').trim()
    || [ cause?.syscall, cause?.address, cause?.port, causeMessage ].filter(Boolean).join(' ');
  const body = {
    code,
    message: String(err?.message || '服务异常'),
    data: null,
  };
  if (errorCode) body.error_code = errorCode;
  if (detail) body.detail = detail;
  if (err?.skill) body.skill = err.skill;
  if (err?.action) body.action = err.action;
  return body;
}

function fail(ctx, err) {
  const body = presentError(err);
  ctx.status = body.code;
  ctx.body = body;
  if (body.code >= 500) {
    ctx.logger.error(
      '[cartoon] %s %s %s %s',
      ctx.method,
      ctx.path,
      body.error_code || '',
      err?.stack || err?.message,
    );
  }
}

module.exports = { presentError, fail };
