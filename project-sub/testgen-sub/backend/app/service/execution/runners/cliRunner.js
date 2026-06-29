'use strict';

const path = require('path');
const { spawn } = require('child_process');

/**
 * @param {string} command
 * @param {string} fitnessAgentRoot
 * @param {string[]} allowlist
 */
function parseAutomationCommand(command, fitnessAgentRoot, allowlist) {
  if (!command || !String(command).trim()) {
    const err = new Error('用例缺少 automation_command');
    err.status = 400;
    err.code = 'CLI_NOT_CONFIGURED';
    throw err;
  }
  if (!fitnessAgentRoot) {
    const err = new Error('未配置 FITNESS_AGENT_ROOT，无法执行 CLI 用例');
    err.status = 400;
    err.code = 'FITNESS_AGENT_ROOT_MISSING';
    throw err;
  }

  let cwd = fitnessAgentRoot;
  let cmd = String(command).trim();
  if (/^cd\s+server\s*&&/i.test(cmd)) {
    cwd = path.join(fitnessAgentRoot, 'server');
    cmd = cmd.replace(/^cd\s+server\s*&&\s*/i, '').trim();
  }

  const allowed = (allowlist || []).some(prefix => cmd.startsWith(prefix));
  if (!allowed) {
    const err = new Error(`命令不在白名单: ${cmd}`);
    err.status = 403;
    err.code = 'CLI_NOT_ALLOWLISTED';
    throw err;
  }

  const npmMatch = cmd.match(/^npm run (test:stations|test:e2e)(?:\s+--\s+(.+))?$/);
  if (!npmMatch) {
    const err = new Error(`无法解析 npm 命令: ${cmd}`);
    err.status = 400;
    err.code = 'CLI_PARSE_ERROR';
    throw err;
  }

  const script = npmMatch[1];
  const extra = npmMatch[2] ? npmMatch[2].trim().split(/\s+/).filter(Boolean) : [];
  const args = [ 'run', script, ...(extra.length ? [ '--', ...extra ] : []) ];
  const isWin = process.platform === 'win32';

  return {
    cwd,
    executable: isWin ? 'npm.cmd' : 'npm',
    args,
    shell: isWin,
    summary: `npm run ${script}${extra.length ? ` -- ${extra.join(' ')}` : ''}`,
  };
}

/**
 * @param {import('egg').Context} ctx
 * @param {{ command: string, timeoutMs?: number }} opts
 */
async function runCli(ctx, opts) {
  const cfg = ctx.app.config.fitnessExecution || {};
  const parsed = parseAutomationCommand(
    opts.command,
    cfg.fitnessAgentRoot,
    cfg.cliAllowlist,
  );
  const timeoutMs = opts.timeoutMs || cfg.cliTimeoutMs || 600000;

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(parsed.executable, parsed.args, {
      cwd: parsed.cwd,
      shell: parsed.shell,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    const maxCapture = 8000;

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
      const err = new Error(`CLI 执行超时 (${timeoutMs}ms)`);
      err.status = 504;
      err.code = 'RUNNER_TIMEOUT';
      reject(err);
    }, timeoutMs);

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', code => {
      clearTimeout(timer);
      resolve({
        exitCode: code,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        command: parsed.summary,
        cwd: parsed.cwd,
      });
    });
  });
}

module.exports = {
  parseAutomationCommand,
  runCli,
};
