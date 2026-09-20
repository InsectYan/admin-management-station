'use strict';

/**
 * AgentRun OpenAPI（ACS3）最小客户端：List / Get / Update。
 * 签名与 fitness-agent patch-runtime-language.mjs 对齐。
 */

const crypto = require('crypto');

const API_VERSION = '2025-09-10';
const PRODUCT = 'agentrun';

function sha256Hex(payload) {
  return crypto.createHash('sha256').update(payload || '', 'utf8').digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function canonicalizeQuery(query) {
  const keys = Object.keys(query || {}).sort();
  return keys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key] ?? ''))}`)
    .join('&');
}

function pickRuntime(payload, agentName) {
  const data = payload?.data || payload?.Data || payload || {};
  if (data.agentRuntimeId || data.AgentRuntimeId) return data;
  const items = data.items || data.Items || data.agentRuntimes || [];
  if (!Array.isArray(items) || !items.length) return null;
  const exact = items.find(item => (
    String(item.agentRuntimeName || item.AgentRuntimeName || '') === agentName
  ));
  return exact || items[0];
}

function runtimeIdOf(rt) {
  return String(rt?.agentRuntimeId || rt?.AgentRuntimeId || '').trim();
}

function statusOf(rt) {
  return String(rt?.status || rt?.Status || '').trim().toUpperCase();
}

function envMapOf(rt) {
  const raw = rt?.environmentVariables || rt?.EnvironmentVariables || {};
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
}

function languageOf(rt) {
  const code = rt?.codeConfiguration || rt?.CodeConfiguration || {};
  return String(code.language || code.Language || '').trim();
}

async function acsRequest({
  method,
  region,
  pathname,
  query = {},
  bodyObj = null,
  accessKeyId,
  accessKeySecret,
  action,
}) {
  const host = `${PRODUCT}.${region}.aliyuncs.com`;
  const body = bodyObj == null ? '' : JSON.stringify(bodyObj);
  const hashedPayload = sha256Hex(body);
  const datetime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = crypto.randomUUID();
  const headers = {
    host,
    'x-acs-action': action,
    'x-acs-content-sha256': hashedPayload,
    'x-acs-date': datetime,
    'x-acs-signature-nonce': nonce,
    'x-acs-version': API_VERSION,
  };
  if (body) headers['content-type'] = 'application/json';
  const signedHeaderNames = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderNames.map(name => `${name}:${headers[name]}`).join('\n') + '\n';
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalRequest = [
    method.toUpperCase(),
    pathname,
    canonicalizeQuery(query),
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n');
  const stringToSign = `ACS3-HMAC-SHA256\n${sha256Hex(canonicalRequest)}`;
  const signature = hmacSha256(accessKeySecret, stringToSign).toString('hex');
  headers.authorization = `ACS3-HMAC-SHA256 Credential=${accessKeyId},SignedHeaders=${signedHeaders},Signature=${signature}`;

  const qs = canonicalizeQuery(query);
  const url = `https://${host}${pathname}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = json?.message || json?.Message || text || res.statusText;
    const reqId = json?.requestId || json?.RequestId || '';
    const err = new Error(`AgentRun ${action} 失败：${msg}${reqId ? `（requestId=${reqId}）` : ''}`);
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }
  return json;
}

async function listRuntime(creds, region, agentName, workspaceId) {
  const query = {
    agentRuntimeName: agentName,
    pageNumber: 1,
    pageSize: 20,
  };
  if (workspaceId) query.workspaceId = workspaceId;
  const json = await acsRequest({
    method: 'GET',
    region,
    pathname: '/2025-09-10/agents/runtimes',
    query,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    action: 'ListAgentRuntimes',
  });
  return pickRuntime(json, agentName);
}

async function getRuntime(creds, region, id) {
  const json = await acsRequest({
    method: 'GET',
    region,
    pathname: `/2025-09-10/agents/runtimes/${encodeURIComponent(id)}`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    action: 'GetAgentRuntime',
  });
  return pickRuntime(json, '');
}

async function updateRuntime(creds, region, id, bodyObj) {
  return acsRequest({
    method: 'PUT',
    region,
    pathname: `/2025-09-10/agents/runtimes/${encodeURIComponent(id)}`,
    bodyObj,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    action: 'UpdateAgentRuntime',
  });
}

async function waitReady(creds, region, id, { timeoutMs = 180000, intervalMs = 5000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const rt = await getRuntime(creds, region, id);
    const st = statusOf(rt);
    if (st === 'READY') return rt;
    if (st.includes('FAILED')) {
      const err = new Error(`运行时 ${id} ${st}：${rt.statusReason || rt.StatusReason || ''}`);
      err.status = 502;
      throw err;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  const err = new Error(`等待运行时 READY 超时（${Math.round(timeoutMs / 1000)}s）`);
  err.status = 504;
  throw err;
}

module.exports = {
  listRuntime,
  getRuntime,
  updateRuntime,
  waitReady,
  runtimeIdOf,
  statusOf,
  envMapOf,
  languageOf,
  pickRuntime,
};
