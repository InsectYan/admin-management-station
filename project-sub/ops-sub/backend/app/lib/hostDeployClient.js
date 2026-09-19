'use strict';

const http = require('http');
const { mapContainerPathToHost } = require('./deployNetwork');

/**
 * 通过宿主机 host-deploy-runner 执行命令，日志经 onLog 回灌黑窗口。
 */
function execOnHost(opts) {
  const {
    cwd,
    argv,
    env = {},
    timeoutMs,
    onLog,
    runnerHost = process.env.OPS_HOST_RUNNER_HOST || 'host.docker.internal',
    runnerPort = Number(process.env.OPS_HOST_RUNNER_PORT || 1329),
    token = process.env.OPS_INTERNAL_KEY || process.env.JWT_SECRET || '',
  } = opts;

  const hostCwd = mapContainerPathToHost(cwd, process.env);
  const payload = JSON.stringify({
    cwd: hostCwd,
    argv,
    env,
    timeoutMs,
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: runnerHost,
        port: runnerPort,
        path: '/v1/exec',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(token ? { Authorization: `Bearer ${token}`, 'x-ops-internal-key': token } : {}),
        },
        timeout: timeoutMs + 60000,
      },
      res => {
        if (res.statusCode === 401) {
          reject(new Error('宿主机执行器鉴权失败（OPS_INTERNAL_KEY 需与 host-deploy-runner 一致）'));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`宿主机执行器 HTTP ${res.statusCode}`));
          return;
        }
        let buf = '';
        let settled = false;
        const finish = (err, code) => {
          if (settled) return;
          settled = true;
          if (err) reject(err);
          else if (code === 0) resolve();
          else reject(new Error(`宿主机命令失败 exit ${code}`));
        };
        res.on('data', chunk => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            let msg;
            try {
              msg = JSON.parse(line);
            } catch {
              continue;
            }
            if (msg.type === 'log' && msg.text && typeof onLog === 'function') {
              onLog(msg.text, msg.stream === 'stderr' ? 'warn' : 'info');
            } else if (msg.type === 'start' || msg.type === 'spawned') {
              if (typeof onLog === 'function') {
                onLog(`[host-runner] ${msg.type} cwd=${msg.cwd || hostCwd}`, 'info');
              }
            } else if (msg.type === 'timeout') {
              finish(new Error(`宿主机命令超时（${Math.round(timeoutMs / 60000)} 分钟）`));
            } else if (msg.type === 'error') {
              finish(new Error(msg.message || 'host-runner error'));
            } else if (msg.type === 'exit') {
              finish(null, msg.code);
            }
          }
        });
        res.on('end', () => {
          if (!settled) finish(new Error('宿主机执行器连接已关闭且未返回 exit'));
        });
        res.on('error', err => finish(err));
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('连接宿主机执行器超时'));
    });
    req.on('error', err => reject(new Error(`无法连接宿主机执行器 ${runnerHost}:${runnerPort}：${err.message}`)));
    req.write(payload);
    req.end();
  });
}

module.exports = { execOnHost };
