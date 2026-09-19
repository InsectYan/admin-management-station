#!/usr/bin/env node
/**
 * Host deploy runner — 在 Windows 宿主机网络栈上执行 AgentRun / s deploy。
 * 解决 Docker Desktop 容器无法 TLS 到阿里云 FC/OSS 的问题（与 fitness-cli 同路径）。
 *
 * ams-ops local 自动启动；容器经 host.docker.internal:1329 调用。
 */
'use strict';

const http = require('http');
const { spawn } = require('child_process');
const { URL } = require('url');

const PORT = Number(process.env.OPS_HOST_RUNNER_PORT || 1329);
const BIND = process.env.OPS_HOST_RUNNER_BIND || '0.0.0.0';
const TOKEN = process.env.OPS_INTERNAL_KEY || process.env.JWT_SECRET || '';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function authOk(req) {
  if (!TOKEN) return true;
  const h = req.headers.authorization || '';
  if (h === `Bearer ${TOKEN}`) return true;
  if (req.headers['x-ops-internal-key'] === TOKEN) return true;
  return false;
}

function writeNdjson(res, obj) {
  res.write(`${JSON.stringify(obj)}\n`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'ams-ops-host-deploy-runner', port: PORT }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/exec') {
    if (!authOk(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid json' }));
      return;
    }
    const argv = Array.isArray(body.argv) ? body.argv.map(String) : [];
    const cwd = String(body.cwd || '').trim();
    const timeoutMs = Number(body.timeoutMs || 45 * 60 * 1000);
    if (!argv.length || !cwd) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'cwd and argv required' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    writeNdjson(res, { type: 'start', cwd, argv, pid: null });

    const childEnv = { ...process.env, ...(body.env && typeof body.env === 'object' ? body.env : {}) };
    // 宿主机直连：禁止残留代理 / CONNECT agent
    for (const k of [
      'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY',
      'http_proxy', 'https_proxy', 'all_proxy',
      'OPS_HOST_EGRESS_PROXY',
    ]) {
      delete childEnv[k];
    }
    if (childEnv.NODE_OPTIONS && String(childEnv.NODE_OPTIONS).includes('hostEgressAgent')) {
      delete childEnv.NODE_OPTIONS;
    }

    const bin = argv[0] === 'node' ? process.execPath : argv[0];
    const args = argv[0] === 'node' ? argv.slice(1) : argv.slice(1);
    const child = spawn(bin, args, {
      cwd,
      env: childEnv,
      windowsHide: true,
      shell: false,
    });
    writeNdjson(res, { type: 'spawned', pid: child.pid });

    const onChunk = (buf, stream) => {
      String(buf).split(/\r?\n|\r/).forEach(line => {
        const text = line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim();
        if (text) writeNdjson(res, { type: 'log', stream, text });
      });
    };
    child.stdout.on('data', buf => onChunk(buf, 'stdout'));
    child.stderr.on('data', buf => onChunk(buf, 'stderr'));

    const timer = setTimeout(() => {
      writeNdjson(res, { type: 'timeout', timeoutMs });
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('error', err => {
      clearTimeout(timer);
      writeNdjson(res, { type: 'error', message: err.message });
      res.end();
    });
    child.on('close', code => {
      clearTimeout(timer);
      writeNdjson(res, { type: 'exit', code: code == null ? 1 : code });
      res.end();
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found\n');
});

server.listen(PORT, BIND, () => {
  console.log(`[ams-ops-host-runner] listening ${BIND}:${PORT}`);
});
