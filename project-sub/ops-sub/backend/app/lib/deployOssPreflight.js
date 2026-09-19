'use strict';

const dns = require('dns').promises;
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const path = require('path');

const ACCELERATE_HOST = 'fc-hz-yunqi-temp-code.oss-accelerate.aliyuncs.com';
const REGIONAL_HOST = 'oss-cn-hangzhou.aliyuncs.com';
const FC_SAMPLE_HOST = 'cn-hangzhou.fc.aliyuncs.com';

function hostEgressPort(env = process.env) {
  return Number(env.OPS_HOST_EGRESS_PORT || 1328);
}

function hostEgressProxyUrl(env = process.env) {
  const host = env.OPS_HOST_EGRESS_HOST || 'host.docker.internal';
  return `http://${host}:${hostEgressPort(env)}`;
}

function withTimeout(ms, label) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms);
  });
}

function headHttps(host, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = https.request(
      { host, method: 'HEAD', path: '/', timeout: timeoutMs, servername: host },
      res => {
        res.resume();
        resolve({ host, status: res.statusCode, ms: Date.now() - started });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`${host} HTTPS 超时`));
    });
    req.on('error', err => reject(new Error(`${host} HTTPS 失败：${err.message}`)));
    req.end();
  });
}

function putProbe(host, sizeMb, timeoutMs = 30000) {
  const total = sizeMb * 1024 * 1024;
  const chunk = Buffer.alloc(Math.min(1024 * 1024, total), 1);
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let written = 0;
    const req = https.request(
      {
        host,
        method: 'PUT',
        path: '/ops-deploy-oss-preflight',
        headers: { 'Content-Length': total, 'Content-Type': 'application/octet-stream' },
        timeout: timeoutMs,
        servername: host,
      },
      res => {
        res.resume();
        const ms = Date.now() - started;
        resolve({
          host,
          via: 'direct',
          status: res.statusCode,
          ms,
          sizeMb,
          mbps: Number(((sizeMb * 8) / (ms / 1000)).toFixed(2)),
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`${host} 直连上传探测超时（已写 ${(written / 1024 / 1024).toFixed(1)}MB / ${sizeMb}MB）`));
    });
    req.on('error', err => {
      if (written >= total && /EPIPE|ECONNRESET|socket hang up/i.test(err.message)) {
        const ms = Date.now() - started;
        resolve({
          host,
          via: 'direct',
          status: -1,
          ms,
          sizeMb,
          mbps: Number(((sizeMb * 8) / (ms / 1000)).toFixed(2)),
          note: err.message,
        });
        return;
      }
      reject(new Error(`${host} 直连上传探测失败：${err.message}（已写 ${(written / 1024 / 1024).toFixed(1)}MB）`));
    });
    function writeMore() {
      while (written < total) {
        const n = Math.min(chunk.length, total - written);
        const buf = n === chunk.length ? chunk : chunk.subarray(0, n);
        written += n;
        if (!req.write(buf)) {
          req.once('drain', writeMore);
          return;
        }
      }
      req.end();
    }
    writeMore();
  });
}

/** PUT probe through host CONNECT proxy — same egress path as AgentRun s deploy. */
function putProbeViaHostEgress(host, sizeMb, env = process.env, timeoutMs = 60000) {
  const total = sizeMb * 1024 * 1024;
  const chunk = Buffer.alloc(Math.min(256 * 1024, total), 1);
  const proxyPort = hostEgressPort(env);
  const proxyHost = env.OPS_HOST_EGRESS_HOST || 'host.docker.internal';
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let written = 0;
    const socket = net.connect({ host: proxyHost, port: proxyPort }, () => {
      socket.write(`CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\n\r\n`);
    });
    socket.setTimeout(timeoutMs);
    let buf = Buffer.alloc(0);
    const onConnectData = data => {
      buf = Buffer.concat([ buf, data ]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx < 0) return;
      socket.removeListener('data', onConnectData);
      const head = buf.slice(0, idx).toString('utf8');
      const status = Number((head.split(' ')[1] || '0'));
      if (status !== 200) {
        socket.destroy();
        reject(new Error(`宿主机代理 CONNECT ${host} → HTTP ${status}`));
        return;
      }
      const rest = buf.slice(idx + 4);
      if (rest.length) socket.unshift(rest);
      const tlsSock = tls.connect({ socket, servername: host }, () => {
        const header =
          `PUT /ops-deploy-oss-preflight HTTP/1.1\r\n` +
          `Host: ${host}\r\n` +
          `Content-Length: ${total}\r\n` +
          `Content-Type: application/octet-stream\r\n` +
          `Connection: close\r\n\r\n`;
        tlsSock.write(header);
        function writeMore() {
          while (written < total) {
            const n = Math.min(chunk.length, total - written);
            const piece = n === chunk.length ? chunk : chunk.subarray(0, n);
            written += n;
            if (!tlsSock.write(piece)) {
              tlsSock.once('drain', writeMore);
              return;
            }
          }
        }
        writeMore();
        let resp = '';
        tlsSock.on('data', d => {
          resp += d.toString();
        });
        tlsSock.on('end', () => {
          const ms = Date.now() - started;
          const code = Number((resp.split(' ')[1] || '0'));
          resolve({
            host,
            via: 'host-egress',
            status: code || 403,
            ms,
            sizeMb,
            mbps: Number(((sizeMb * 8) / (ms / 1000)).toFixed(2)),
          });
        });
      });
      tlsSock.setTimeout(timeoutMs, () => {
        tlsSock.destroy();
        reject(new Error(
          `经宿主机代理上传探测超时（已写 ${(written / 1024 / 1024).toFixed(1)}MB / ${sizeMb}MB）`,
        ));
      });
      tlsSock.on('error', err => {
        if (written >= total && /EPIPE|ECONNRESET|socket hang up/i.test(err.message)) {
          const ms = Date.now() - started;
          resolve({
            host,
            via: 'host-egress',
            status: -1,
            ms,
            sizeMb,
            mbps: Number(((sizeMb * 8) / (ms / 1000)).toFixed(2)),
            note: err.message,
          });
          return;
        }
        reject(new Error(
          `经宿主机代理上传探测失败：${err.message}（已写 ${(written / 1024 / 1024).toFixed(1)}MB）`,
        ));
      });
    };
    socket.on('data', onConnectData);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`宿主机代理 CONNECT ${host} 超时`));
    });
    socket.on('error', err => reject(new Error(`连宿主机代理失败：${err.message}`)));
  });
}

function probeHostEgress(env = process.env, timeoutMs = 3000) {
  const port = hostEgressPort(env);
  const host = env.OPS_HOST_EGRESS_HOST || 'host.docker.internal';
  return new Promise(resolve => {
    const req = http.request(
      { host, port, method: 'GET', path: '/', timeout: timeoutMs },
      res => {
        res.resume();
        resolve({ reachable: true, host, port, status: res.statusCode });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ reachable: false, host, port });
    });
    req.on('error', () => resolve({ reachable: false, host, port }));
    req.end();
  });
}

/** TLS to target via host CONNECT proxy (same path AgentRun will use). */
function tlsViaHostEgress(targetHost, env = process.env, timeoutMs = 15000) {
  const port = hostEgressPort(env);
  const proxyHost = env.OPS_HOST_EGRESS_HOST || 'host.docker.internal';
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const socket = net.connect({ host: proxyHost, port }, () => {
      socket.write(
        `CONNECT ${targetHost}:443 HTTP/1.1\r\nHost: ${targetHost}:443\r\n\r\n`,
      );
    });
    socket.setTimeout(timeoutMs);
    let buf = Buffer.alloc(0);
    const onData = chunk => {
      buf = Buffer.concat([ buf, chunk ]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx < 0) return;
      socket.removeListener('data', onData);
      const head = buf.slice(0, idx).toString('utf8');
      const status = Number((head.split(' ')[1] || '0'));
      if (status !== 200) {
        socket.destroy();
        reject(new Error(`宿主机代理 CONNECT ${targetHost} → HTTP ${status}`));
        return;
      }
      const rest = buf.slice(idx + 4);
      if (rest.length) socket.unshift(rest);
      const tlsSock = tls.connect({ socket, servername: targetHost }, () => {
        tlsSock.end();
        resolve({ host: targetHost, ms: Date.now() - started });
      });
      tlsSock.setTimeout(timeoutMs, () => {
        tlsSock.destroy();
        reject(new Error(`经宿主机代理 TLS ${targetHost} 超时`));
      });
      tlsSock.on('error', err => reject(new Error(`经宿主机代理 TLS ${targetHost}：${err.message}`)));
    };
    socket.on('data', onData);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`宿主机代理 CONNECT ${targetHost} 超时`));
    });
    socket.on('error', err => reject(new Error(`连宿主机代理 ${proxyHost}:${port} 失败：${err.message}`)));
  });
}

async function tlsOk(host, timeoutMs = 10000) {
  try {
    await Promise.race([ headHttps(host, timeoutMs), withTimeout(timeoutMs + 500, host) ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a hangzhou FC account host for probing (tempBucketToken path).
 * Prefer account id from access.yaml-ish env; fallback to generic regional pattern via sample.
 */
function resolveFcProbeHost(env = process.env) {
  const account = String(env.OPS_FC_PROBE_ACCOUNT || env.ALIBABA_CLOUD_ACCOUNT_ID || '').trim();
  if (account) return `${account}.cn-hangzhou.fc.aliyuncs.com`;
  // DNS for bare cn-hangzhou.fc.aliyuncs.com may ENOTFOUND; use a known working alias shape
  // fc.cn-hangzhou.aliyuncs.com resolves and shares the same TLS path
  return 'fc.cn-hangzhou.aliyuncs.com';
}

/**
 * AgentRun 上传前网络预检。
 * 默认直连（ECS / 宿主机执行器 / 容器 TLS 正常时）。
 * 旧 CONNECT 代理仅 OPS_HOST_EGRESS_ENABLED=1 时启用（不推荐）。
 */
async function runOssPreflight(env = process.env) {
  const { egressEnabled } = require('./deployNetwork');
  const lines = [];

  // 直连模式（ECS / 宿主机执行器）：不依赖 :1328 代理
  if (!egressEnabled(env) || truthyDisabled(env.OPS_HOST_EGRESS_DISABLED)) {
    lines.push('[oss-preflight] 模式=直连（无宿主机 CONNECT 代理）');
    try {
      const a = await dns.resolve4(ACCELERATE_HOST);
      lines.push(`[oss-preflight] DNS ${ACCELERATE_HOST} → ${a.slice(0, 2).join(', ')}`);
    } catch (err) {
      return { ok: false, lines, error: `无法解析 OSS 加速域名：${err.message}` };
    }
    try {
      const head = await headHttps(ACCELERATE_HOST);
      lines.push(`[oss-preflight] HTTPS 加速 → HTTP ${head.status}（${head.ms}ms）`);
    } catch (err) {
      return { ok: false, lines, error: err.message };
    }
    try {
      const put = await putProbe(ACCELERATE_HOST, Number(env.OPS_DEPLOY_OSS_PROBE_MB || 2), 30000);
      lines.push(
        `[oss-preflight] 直连上传探测 ${put.sizeMb}MB → ${put.ms}ms ≈ ${put.mbps} Mbps（status=${put.status}）`,
      );
      lines.push('[oss-preflight] 通过');
      return { ok: true, lines, put, mode: 'direct' };
    } catch (err) {
      return {
        ok: false,
        lines,
        error: `${err.message}。若在 Windows Docker Desktop，请改用宿主机执行器（ams-ops local 启动 host-deploy-runner）`,
      };
    }
  }

  const egress = await probeHostEgress(env);
  if (!egress.reachable) {
    return {
      ok: false,
      lines: [
        `[oss-preflight] 宿主机出网代理未就绪：${egress.host}:${egress.port}`,
        '[oss-preflight] 推荐改用宿主机执行器而非 CONNECT 代理；或设 OPS_HOST_EGRESS_DISABLED=1 走直连',
      ],
      error: `缺少宿主机出网代理 ${egress.host}:${egress.port}`,
    };
  }
  lines.push(`[oss-preflight] 宿主机出网代理就绪 ${egress.host}:${egress.port}`);

  const fcHost = resolveFcProbeHost(env);
  const fcDirect = await tlsOk(fcHost, 8000);
  if (fcDirect) {
    lines.push(`[oss-preflight] FC ${fcHost} 容器直连 TLS 正常`);
  } else {
    lines.push(`[oss-preflight] FC ${fcHost} 容器直连 TLS 失败（Docker→阿里云区域站常见）`);
    try {
      const via = await tlsViaHostEgress(fcHost, env);
      lines.push(`[oss-preflight] FC 经宿主机代理 TLS 正常（${via.ms}ms）→ deploy 将走此路径拿 tempBucketToken`);
    } catch (err) {
      return {
        ok: false,
        lines,
        error: `${err.message}。与报错「tempBucketToken … TLS disconnected」同类，请确认宿主机代理进程在跑且宿主机本身能访问阿里云`,
      };
    }
  }

  try {
    const a = await dns.resolve4(ACCELERATE_HOST);
    lines.push(`[oss-preflight] DNS ${ACCELERATE_HOST} → ${a.slice(0, 2).join(', ')}`);
  } catch (err) {
    return { ok: false, lines, error: `无法解析 OSS 加速域名：${err.message}` };
  }

  try {
    const head = await headHttps(ACCELERATE_HOST);
    lines.push(`[oss-preflight] HTTPS 加速 ${ACCELERATE_HOST} → HTTP ${head.status}（${head.ms}ms）`);
  } catch (err) {
    try {
      const via = await tlsViaHostEgress(ACCELERATE_HOST, env);
      lines.push(`[oss-preflight] 加速域名直连失败，经宿主机代理 TLS 正常（${via.ms}ms）`);
    } catch {
      return { ok: false, lines, error: err.message };
    }
  }

  const regionalOk = await tlsOk(REGIONAL_HOST, 8000);
  if (!regionalOk) {
    lines.push(
      `[oss-preflight] ${REGIONAL_HOST} 容器直连 TLS 失败；已强制 OSS 加速 endpoint，FC/区域 API 走宿主机代理`,
    );
  }

  const probeMb = Number(env.OPS_DEPLOY_OSS_PROBE_MB || 4);
  let put;
  try {
    put = await putProbeViaHostEgress(ACCELERATE_HOST, probeMb, env, 60000);
    lines.push(
      `[oss-preflight] 经宿主机代理上传探测 ${put.sizeMb}MB → ${put.ms}ms ≈ ${put.mbps} Mbps（status=${put.status}）`,
    );
  } catch (err) {
    lines.push(`[oss-preflight] 宿主机代理上传失败：${err.message}；尝试容器直连作对照…`);
    try {
      put = await putProbe(ACCELERATE_HOST, Math.min(probeMb, 2), 30000);
      lines.push(
        `[oss-preflight] 直连上传探测 ${put.sizeMb}MB → ${put.ms}ms ≈ ${put.mbps} Mbps（status=${put.status}）`,
      );
    } catch (directErr) {
      return {
        ok: false,
        lines,
        error:
          `${err.message}；直连亦失败：${directErr.message}。` +
          '请确认宿主机代理仍在监听，且本机浏览器/curl 能访问阿里云',
      };
    }
  }

  const minMbps = Number(env.OPS_DEPLOY_OSS_MIN_MBPS || 1);
  if (put.mbps < minMbps) {
    return {
      ok: false,
      lines,
      error: `OSS 上传过慢（${put.mbps} Mbps < ${minMbps} Mbps，via=${put.via}）`,
    };
  }

  lines.push('[oss-preflight] 通过：可继续 s deploy（FC/OSS 经宿主机代理出网）');
  return { ok: true, lines, put, regionalOk, egress, fcDirect };
}

function truthyDisabled(v) {
  return /^(1|true|yes|on)$/i.test(String(v || '').trim());
}

function agentrunNetworkEnv(env = process.env) {
  const { egressEnabled } = require('./deployNetwork');
  const base = {
    HTTP_PROXY: '',
    HTTPS_PROXY: '',
    http_proxy: '',
    https_proxy: '',
    ALL_PROXY: '',
    all_proxy: '',
    NO_PROXY: '',
    no_proxy: '',
    FC_CODE_TEMP_OSS_ENDPOINT: 'https://oss-accelerate.aliyuncs.com',
    FC_REGION: '',
    AGENTRUN_CUSTOM_ENDPOINT: '',
    NPM_CONFIG_REGISTRY: env.OPS_NPM_REGISTRY || env.NPM_CONFIG_REGISTRY || 'https://registry.npmmirror.com',
  };

  // 默认直连；仅显式 OPS_HOST_EGRESS_ENABLED=1 才注入旧 CONNECT 代理（不推荐）
  if (!egressEnabled(env)) {
    return base;
  }

  const proxy = hostEgressProxyUrl(env);
  const agentPath = path.join(__dirname, 'hostEgressAgent.js');
  const prevNodeOptions = String(env.NODE_OPTIONS || '').trim();
  const requireFlag = `--require ${agentPath}`;
  const nodeOptions = prevNodeOptions.includes('hostEgressAgent')
    ? prevNodeOptions
    : [ prevNodeOptions, requireFlag ].filter(Boolean).join(' ');

  return {
    ...base,
    OPS_HOST_EGRESS_PROXY: proxy,
    NODE_OPTIONS: nodeOptions,
  };
}

module.exports = {
  runOssPreflight,
  agentrunNetworkEnv,
  hostEgressProxyUrl,
  hostEgressPort,
  ACCELERATE_HOST,
  REGIONAL_HOST,
  FC_SAMPLE_HOST,
};
