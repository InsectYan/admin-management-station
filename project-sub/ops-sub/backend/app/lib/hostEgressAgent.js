'use strict';

/**
 * Patch Node http(s).request so traffic exits via HTTPS_PROXY CONNECT tunnel.
 * Used by AgentRun / s CLI child (NODE_OPTIONS=--require …).
 *
 * Important: urllib / ali-oss also honor HTTPS_PROXY and issue their own
 * CONNECT via http.request — those must bypass this patch, otherwise we
 * CONNECT to the proxy through the proxy (502).
 */
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const { URL } = require('url');

function proxyUrl() {
  const raw = process.env.OPS_HOST_EGRESS_PROXY
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy || '';
  if (!raw.trim()) {
    // 默认宿主机出网代理（与 ams-ops local 一致）
    const host = process.env.OPS_HOST_EGRESS_HOST || 'host.docker.internal';
    const port = process.env.OPS_HOST_EGRESS_PORT || '1328';
    return new URL(`http://${host}:${port}`);
  }
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function splitHostPort(value, fallbackPort) {
  const raw = String(value || '');
  if (!raw) return { hostname: '', port: fallbackPort };
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    if (end > 0) {
      const hostname = raw.slice(1, end);
      const rest = raw.slice(end + 1);
      const port = rest.startsWith(':') ? Number(rest.slice(1)) || fallbackPort : fallbackPort;
      return { hostname, port };
    }
  }
  if (raw.includes(':') && raw.indexOf(':') === raw.lastIndexOf(':')) {
    const [ hostname, portStr ] = raw.split(':');
    return { hostname, port: Number(portStr) || fallbackPort };
  }
  return { hostname: raw, port: fallbackPort };
}

function shouldBypass(hostname, proxy) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return true;
  if (proxy && host === String(proxy.hostname || '').toLowerCase()) return true;
  if (host === 'host.docker.internal' || host === 'localhost' || host === '127.0.0.1') return true;

  const noProxy = process.env.NO_PROXY || process.env.no_proxy || '';
  if (!noProxy || noProxy.trim() === '') return false;
  if (noProxy.trim() === '*') return true;
  return noProxy.split(/[\s,]+/).filter(Boolean).some(rule => {
    const r = rule.toLowerCase();
    if (r === host) return true;
    if (r.startsWith('.') && host.endsWith(r)) return true;
    if (r.startsWith('*.') && host.endsWith(r.slice(1))) return true;
    return host.endsWith('.' + r);
  });
}

/** Raw TCP CONNECT — never goes through patched http.request. */
function connectViaProxy(proxy, targetHost, targetPort) {
  return new Promise((resolve, reject) => {
    const proxyPort = Number(proxy.port) || 80;
    const socket = net.connect({ host: proxy.hostname, port: proxyPort }, () => {
      socket.write(
        `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
        `Host: ${targetHost}:${targetPort}\r\n` +
        `Proxy-Connection: keep-alive\r\n\r\n`,
      );
    });
    socket.setTimeout(30000);
    let buf = Buffer.alloc(0);
    const onData = chunk => {
      buf = Buffer.concat([ buf, chunk ]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx < 0) return;
      socket.removeListener('data', onData);
      const head = buf.slice(0, idx).toString('utf8');
      const rest = buf.slice(idx + 4);
      const status = Number((head.split(' ')[1] || '0'));
      if (status !== 200) {
        socket.destroy();
        reject(new Error(`CONNECT ${proxy.host} → ${targetHost}:${targetPort} status ${status}`));
        return;
      }
      if (rest.length) socket.unshift(rest);
      resolve(socket);
    };
    socket.on('data', onData);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`CONNECT timeout ${proxy.host} → ${targetHost}:${targetPort}`));
    });
    socket.on('error', reject);
  });
}

function parseArgs(args, isHttps) {
  let options;
  let callback;
  if (typeof args[0] === 'string' || args[0] instanceof URL) {
    const parsed = new URL(args[0]);
    if (typeof args[1] === 'object' && args[1] !== null && typeof args[1] !== 'function') {
      options = Object.assign({}, args[1], {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        host: parsed.host,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
      });
      callback = args[2];
    } else {
      options = {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        host: parsed.host,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'GET',
      };
      callback = args[1];
    }
  } else {
    options = { ...(args[0] || {}) };
    callback = args[1];
  }
  const fallbackPort = isHttps ? 443 : 80;
  const fromHost = splitHostPort(options.hostname || options.host, fallbackPort);
  const hostname = options.hostname || fromHost.hostname;
  const port = Number(options.port) || fromHost.port || fallbackPort;
  const method = String(options.method || 'GET').toUpperCase();
  return { options, callback, hostname, port, method };
}

function install() {
  // axios / urllib 若看到 HTTPS_PROXY，会对 CONNECT-only 代理发普通 GET，
  // 拿到健康检查文案后 s CLI 会误报「release/latest is not found」。
  for (const key of [
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY',
    'http_proxy', 'https_proxy', 'all_proxy',
  ]) {
    delete process.env[key];
  }

  const proxy = proxyUrl();
  if (!proxy) return;

  const originalHttpsRequest = https.request;
  const originalHttpRequest = http.request;

  function wrapRequest(original, isHttps) {
    return function patchedRequest(...args) {
      const { options, callback, hostname, port, method } = parseArgs(args, isHttps);

      // urllib issues CONNECT to the proxy via http.request — must not re-tunnel
      if (method === 'CONNECT' || shouldBypass(hostname, proxy) || options.createConnection) {
        return original.apply(this, args);
      }

      const opts = { ...options, hostname, port };
      delete opts.host;
      opts.createConnection = (_opts, cb) => {
        connectViaProxy(proxy, hostname, port)
          .then(socket => {
            if (!isHttps) {
              cb(null, socket);
              return;
            }
            const tlsSocket = tls.connect({
              socket,
              servername: hostname,
              rejectUnauthorized: opts.rejectUnauthorized !== false,
            }, () => cb(null, tlsSocket));
            tlsSocket.on('error', err => cb(err));
          })
          .catch(cb);
      };

      if (callback) return original.call(this, opts, callback);
      return original.call(this, opts);
    };
  }

  https.request = wrapRequest(originalHttpsRequest, true);
  http.request = wrapRequest(originalHttpRequest, false);
  https.get = function(...args) {
    const req = https.request(...args);
    req.end();
    return req;
  };
  http.get = function(...args) {
    const req = http.request(...args);
    req.end();
    return req;
  };

  process.stderr.write(
    `[host-egress-agent] https.request → CONNECT ${proxy.protocol}//${proxy.host}\n`,
  );
}

install();
module.exports = { proxyUrl, shouldBypass, connectViaProxy };
