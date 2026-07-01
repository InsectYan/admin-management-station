'use strict';

const axios = require('axios');
const { methodNeedsBody } = require('../../../lib/httpRequestBody');

/**
 * @param {import('egg').Context} ctx
 * @param {{ baseUrl: string, path: string, method?: string, headers?: object, body?: unknown, timeoutMs?: number }} opts
 */
async function runHttp(ctx, opts) {
  const cfg = ctx.app.config.fitnessExecution || {};
  const base = String(opts.baseUrl || '').replace(/\/$/, '');
  const rel = String(opts.path || '').startsWith('/') ? opts.path : `/${opts.path || ''}`;
  const url = `${base}${rel}`;
  const method = (opts.method || 'GET').toUpperCase();
  const started = Date.now();

  const headers = { ...(opts.headers || {}) };
  if (
    opts.body != null
    && methodNeedsBody(method)
    && !headers['Content-Type']
    && !headers['content-type']
  ) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await axios({
    url,
    method,
    headers,
    data: opts.body,
    timeout: opts.timeoutMs || cfg.httpTimeoutMs || 120000,
    validateStatus: () => true,
  });

  return {
    url,
    method,
    statusCode: response.status,
    body: response.data,
    responseTimeMs: Date.now() - started,
    headers: response.headers,
  };
}

module.exports = { runHttp };
