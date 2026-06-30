'use strict';

const { Client } = require('pg');
const { runHttp } = require('../service/execution/runners/httpRunner');

const MASK = '******';

function buildApiUrl(env) {
  const base = String(env.base_url || '').trim().replace(/\/$/, '');
  if (!base) return null;
  let path = String(env.base_path || '/').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/$/, '');
  return `${base}${path}/health`;
}

function buildAuthHeaders(env) {
  const headers = {};
  const secret = env.auth_secret;
  if (!secret || env.auth_type === 'none') return headers;
  if (env.auth_type === 'bearer') {
    headers.Authorization = `Bearer ${secret}`;
  } else if (env.auth_type === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(secret).toString('base64')}`;
  } else if (env.auth_type === 'apikey') {
    headers['X-API-Key'] = secret;
  }
  return headers;
}

function latencyLoadPct(latencyMs) {
  if (latencyMs == null || !Number.isFinite(latencyMs)) return null;
  return Math.min(99, Math.max(5, Math.round(latencyMs / 25)));
}

function overallFromMetrics(api, db, loadPct) {
  if (api === 'fail' || db === 'fail') return 'down';
  if (api === 'warn' || db === 'warn' || (loadPct != null && loadPct > 80)) return 'degraded';
  return 'healthy';
}

/**
 * @param {import('egg').Context} ctx
 * @param {Record<string, unknown>} env
 * @param {{ timeoutMs?: number }} [opts]
 */
async function probeEnvironment(ctx, env, opts = {}) {
  const timeoutMs = opts.timeoutMs || 10000;
  const result = {
    env_id: env.id,
    name: env.name,
    tier: env.tier,
    api: 'fail',
    db: 'skip',
    load_pct: null,
    latency_ms: null,
    overall: 'down',
    api_message: '',
    db_message: '',
    probe_url: null,
  };

  const url = buildApiUrl(env);
  result.probe_url = url;

  if (!url) {
    result.api = 'warn';
    result.api_message = '未配置 base_url';
  } else {
    try {
      const parsed = new URL(url);
      const res = await runHttp(ctx, {
        baseUrl: `${parsed.protocol}//${parsed.host}`,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers: buildAuthHeaders(env),
        timeoutMs,
      });
      result.latency_ms = res.responseTimeMs;
      result.load_pct = latencyLoadPct(res.responseTimeMs);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        result.api = res.responseTimeMs > 2000 ? 'warn' : 'ok';
        result.api_message = `HTTP ${res.statusCode}`;
      } else if (res.statusCode >= 500) {
        result.api = 'fail';
        result.api_message = `HTTP ${res.statusCode}`;
      } else {
        result.api = 'warn';
        result.api_message = `HTTP ${res.statusCode}`;
      }
    } catch (err) {
      result.api = 'fail';
      result.api_message = err.message || '请求失败';
    }
  }

  if (env.db_host) {
    const client = new Client({
      host: env.db_host,
      port: Number(env.db_port || 5432),
      database: env.db_name || 'postgres',
      user: env.db_user || undefined,
      password: env.db_password || undefined,
      connectionTimeoutMillis: timeoutMs,
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      result.db = 'ok';
      result.db_message = '连接成功';
    } catch (err) {
      result.db = 'fail';
      result.db_message = err.message || '连接失败';
    } finally {
      await client.end().catch(() => {});
    }
  } else {
    result.db = 'skip';
    result.db_message = '未配置数据库';
  }

  result.overall = overallFromMetrics(result.api, result.db, result.load_pct);
  return result;
}

function sanitizeEnv(row, { maskSecrets = true } = {}) {
  const data = row?.toJSON ? row.toJSON() : { ...row };
  if (maskSecrets) {
    if (data.auth_secret) data.auth_secret = MASK;
    if (data.db_password) data.db_password = MASK;
  }
  return data;
}

function pickEnvFields(payload, existing = null) {
  const fields = [
    'name', 'tier', 'base_url', 'base_path', 'auth_type', 'auth_secret',
    'db_host', 'db_port', 'db_name', 'db_user', 'db_password', 'sort_order',
  ];
  const next = {};
  for (const key of fields) {
    if (payload[key] === undefined) continue;
    let val = payload[key];
    if ((key === 'auth_secret' || key === 'db_password') && (val === MASK || val === '')) {
      if (existing) continue;
    }
    next[key] = val;
  }
  return next;
}

module.exports = {
  MASK,
  buildApiUrl,
  probeEnvironment,
  sanitizeEnv,
  pickEnvFields,
};
