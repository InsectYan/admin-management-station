'use strict';

const tls = require('tls');
const http = require('http');
const path = require('path');

/**
 * 部署执行面选择：
 * - direct：容器内直连阿里云（ECS / 本机 fitness-cli 同类网络）
 * - host：Windows Docker Desktop 等容器出网异常时，把 s deploy 丢回宿主机跑
 *
 * 不再把「CONNECT 代理」当主路径——那是网关补丁，脆弱且与 axios/HTTPS_PROXY 冲突。
 */

function truthy(v) {
  return /^(1|true|yes|on)$/i.test(String(v || '').trim());
}

function falsey(v) {
  return /^(0|false|no|off)$/i.test(String(v || '').trim());
}

function probeFcTls(host, timeoutMs = 8000) {
  return new Promise(resolve => {
    if (!host) {
      resolve({ ok: false, ms: 0, error: 'empty-host' });
      return;
    }
    const started = Date.now();
    const sock = tls.connect(
      { host, port: 443, servername: host, timeout: timeoutMs },
      () => {
        sock.end();
        resolve({ ok: true, ms: Date.now() - started });
      },
    );
    sock.on('timeout', () => {
      sock.destroy();
      resolve({ ok: false, ms: Date.now() - started, error: 'timeout' });
    });
    sock.on('error', err => {
      resolve({ ok: false, ms: Date.now() - started, error: err.message });
    });
  });
}

function resolveFcHost(env = process.env) {
  const account = String(env.OPS_FC_PROBE_ACCOUNT || '').trim();
  if (account) return `${account}.cn-hangzhou.fc.aliyuncs.com`;
  return 'fc.cn-hangzhou.aliyuncs.com';
}

function probeHostRunner(env = process.env, timeoutMs = 3000) {
  const host = env.OPS_HOST_RUNNER_HOST || 'host.docker.internal';
  const port = Number(env.OPS_HOST_RUNNER_PORT || 1329);
  return new Promise(resolve => {
    const req = http.request(
      { host, port, method: 'GET', path: '/health', timeout: timeoutMs },
      res => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          resolve({
            reachable: res.statusCode === 200,
            host,
            port,
            body: body.trim(),
          });
        });
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

/**
 * @returns {Promise<{ mode: 'direct'|'host', reason: string, fc?: object, runner?: object }>}
 */
async function resolveDeployExecutor(env = process.env) {
  const forced = String(env.OPS_DEPLOY_EXECUTOR || 'auto').trim().toLowerCase();
  if (forced === 'direct' || forced === 'container') {
    return { mode: 'direct', reason: 'OPS_DEPLOY_EXECUTOR=direct' };
  }
  if (forced === 'host') {
    return { mode: 'host', reason: 'OPS_DEPLOY_EXECUTOR=host' };
  }

  // 显式关闭宿主机代理补丁后，仍按探测结果选执行面
  const fcHost = resolveFcHost(env);
  const fc = await probeFcTls(fcHost);
  if (fc.ok) {
    return {
      mode: 'direct',
      reason: `容器直连 ${fcHost} TLS 正常（${fc.ms}ms）— 与 ECS / 本机 CLI 同类`,
      fc,
    };
  }

  const runner = await probeHostRunner(env);
  if (runner.reachable) {
    return {
      mode: 'host',
      reason:
        `容器直连 ${fcHost} 失败（${fc.error}）；改用宿主机执行器 ${runner.host}:${runner.port}` +
        '（与 fitness-cli 同一网络栈，无需 CONNECT 代理）',
      fc,
      runner,
    };
  }

  return {
    mode: 'direct',
    reason: 'fallback-direct',
    fc,
    runner,
    error:
      `容器无法 TLS 到 ${fcHost}（${fc.error || 'fail'}），且宿主机执行器未就绪（${runner.host}:${runner.port}）。` +
      'Windows Docker Desktop 请先 ams-ops local（会启动 host-deploy-runner）；' +
      'ECS 请确认安全组/出网后设 OPS_DEPLOY_EXECUTOR=direct。',
  };
}

function joinHostPath(root, relParts) {
  const rootNorm = String(root || '');
  const isWin = /^[A-Za-z]:[\\/]/.test(rootNorm) || rootNorm.includes('\\');
  if (!relParts.length) return rootNorm;
  return isWin
    ? path.win32.join(rootNorm, ...relParts)
    : path.posix.join(rootNorm.replace(/\\/g, '/'), ...relParts);
}

function mapContainerPathToHost(containerPath, env = process.env) {
  const cRoot = String(env.OPS_DEPLOY_WORKDIR || '/tmp/ops-deploy').replace(/\\/g, '/').replace(/\/+$/, '');
  const hRoot = String(env.OPS_DEPLOY_WORKDIR_HOST || '').trim();
  const input = String(containerPath || '').replace(/\\/g, '/');
  if (!hRoot) return input;
  if (input === cRoot || input.startsWith(cRoot + '/')) {
    const rel = input.slice(cRoot.length).replace(/^\//, '');
    return rel ? joinHostPath(hRoot, rel.split('/').filter(Boolean)) : hRoot;
  }
  // /host-projects/... → HOST_PROJECTS_MOUNT
  const hostProjectsRoot = String(env.HOST_PROJECTS_ROOT || '/host-projects').replace(/\\/g, '/');
  const hostProjectsMount = String(env.HOST_PROJECTS_MOUNT || '').trim();
  if (hostProjectsMount && (input === hostProjectsRoot || input.startsWith(hostProjectsRoot + '/'))) {
    const rel = input.slice(hostProjectsRoot.length).replace(/^\//, '');
    return rel ? joinHostPath(hostProjectsMount, rel.split('/').filter(Boolean)) : hostProjectsMount;
  }
  return input;
}

function egressEnabled(env = process.env) {
  // 默认关闭；仅显式 OPS_HOST_EGRESS_ENABLED=1 才走旧代理（不推荐）
  if (truthy(env.OPS_HOST_EGRESS_DISABLED)) return false;
  return truthy(env.OPS_HOST_EGRESS_ENABLED);
}

module.exports = {
  probeFcTls,
  probeHostRunner,
  resolveFcHost,
  resolveDeployExecutor,
  mapContainerPathToHost,
  egressEnabled,
  truthy,
  falsey,
};
