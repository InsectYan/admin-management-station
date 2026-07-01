'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/** @type {Map<string, Promise<void>>} */
const installLocks = new Map();

function pathExists(target) {
  try {
    return fs.existsSync(target);
  } catch {
    return false;
  }
}

function getEsbuildPlatformPackage() {
  const { platform, arch } = process;
  if (platform === 'linux') return `@esbuild/linux-${arch === 'x64' ? 'x64' : arch}`;
  if (platform === 'darwin') return `@esbuild/darwin-${arch === 'arm64' ? 'arm64' : 'x64'}`;
  if (platform === 'win32') return '@esbuild/win32-x64';
  return null;
}

/**
 * station 测试依赖 server/node_modules（含 dotenv、tsx 等）
 * 挂载目录若在宿主机安装过依赖，容器内 esbuild 平台包会不匹配，需重装
 */
function needsDependencyInstall(cwd) {
  const nodeModules = path.join(cwd, 'node_modules');
  if (!pathExists(nodeModules)) return true;
  const markers = [ 'dotenv', 'pg', 'express' ];
  if (markers.some(name => !pathExists(path.join(nodeModules, name)))) return true;
  const esbuildPlatform = getEsbuildPlatformPackage();
  if (esbuildPlatform && !pathExists(path.join(nodeModules, esbuildPlatform))) return true;
  return false;
}

function spawnCommand(executable, args, opts) {
  const isWin = process.platform === 'win32';
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: opts.cwd,
      shell: isWin,
      env: { ...process.env, ...(opts.env || {}) },
    });

    let stdout = '';
    let stderr = '';
    const maxCapture = 4000;

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > maxCapture) stdout = stdout.slice(-maxCapture);
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
      if (stderr.length > maxCapture) stderr = stderr.slice(-maxCapture);
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      const err = new Error(`npm 安装超时 (${opts.timeoutMs}ms)`);
      err.status = 504;
      err.code = 'CLI_INSTALL_TIMEOUT';
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    }, opts.timeoutMs);

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const err = new Error(`npm 安装失败 (exit ${code})`);
      err.status = 500;
      err.code = 'CLI_INSTALL_FAILED';
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
  });
}

async function runNpmInstall(cwd, timeoutMs) {
  const hasLock = pathExists(path.join(cwd, 'package-lock.json'));
  const args = hasLock ? [ 'ci', '--no-audit', '--no-fund' ] : [ 'install', '--no-audit', '--no-fund' ];
  const isWin = process.platform === 'win32';
  return spawnCommand(isWin ? 'npm.cmd' : 'npm', args, { cwd, timeoutMs });
}

/**
 * CLI 执行前确保工作区依赖已安装（挂载目录首次运行常见缺失 node_modules）
 */
async function ensureCliWorkspaceDeps(cwd, opts = {}) {
  const autoInstall = opts.autoInstall !== false;
  const timeoutMs = opts.timeoutMs || 600000;

  if (!pathExists(path.join(cwd, 'package.json'))) {
    const err = new Error(`CLI 工作区缺少 package.json: ${cwd}`);
    err.status = 400;
    err.code = 'CLI_WORKSPACE_INVALID';
    throw err;
  }

  if (!autoInstall || !needsDependencyInstall(cwd)) {
    return { installed: false };
  }

  const existing = installLocks.get(cwd);
  if (existing) {
    await existing;
    return { installed: false, waited: true };
  }

  const task = runNpmInstall(cwd, timeoutMs);
  installLocks.set(cwd, task);
  try {
    await task;
    return { installed: true };
  } finally {
    installLocks.delete(cwd);
  }
}

module.exports = {
  ensureCliWorkspaceDeps,
  needsDependencyInstall,
};
