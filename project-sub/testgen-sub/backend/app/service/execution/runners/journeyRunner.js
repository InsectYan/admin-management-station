'use strict';

const axios = require('axios');

/**
 * @param {import('egg').Context} ctx
 * @param {{ baseUrl: string, sessionId?: string, clientTurnId?: string, limit?: number, timeoutMs?: number }} opts
 */
async function listJourneys(ctx, opts) {
  const cfg = ctx.app.config.fitnessExecution || {};
  const base = String(opts.baseUrl || '').replace(/\/$/, '');
  const started = Date.now();
  const params = {};
  if (opts.sessionId) params.session_id = opts.sessionId;
  if (opts.limit != null) params.limit = opts.limit;

  const response = await axios({
    url: `${base}/api/journeys`,
    method: 'GET',
    params,
    timeout: opts.timeoutMs || cfg.httpTimeoutMs || 120000,
    validateStatus: () => true,
  });

  return {
    url: `${base}/api/journeys`,
    method: 'GET',
    statusCode: response.status,
    body: response.data,
    responseTimeMs: Date.now() - started,
  };
}

/**
 * @param {import('egg').Context} ctx
 * @param {{ baseUrl: string, sessionId: string, clientTurnId: string, timeoutMs?: number }} opts
 */
async function getJourney(ctx, opts) {
  const cfg = ctx.app.config.fitnessExecution || {};
  const base = String(opts.baseUrl || '').replace(/\/$/, '');
  const rel = `/api/journeys/${encodeURIComponent(opts.sessionId)}/${encodeURIComponent(opts.clientTurnId)}`;
  const started = Date.now();

  const response = await axios({
    url: `${base}${rel}`,
    method: 'GET',
    timeout: opts.timeoutMs || cfg.httpTimeoutMs || 120000,
    validateStatus: () => true,
  });

  return {
    url: `${base}${rel}`,
    method: 'GET',
    statusCode: response.status,
    body: response.data,
    responseTimeMs: Date.now() - started,
  };
}

module.exports = { listJourneys, getJourney };
