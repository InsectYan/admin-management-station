'use strict';

const fs = require('fs');
const path = require('path');

const AUTO_DETECT_PATHS = [
  '/fitness-agent',
  '/workspace/fitness-agent',
];

function pathLooksValid(root) {
  if (!root || !String(root).trim()) return false;
  try {
    return fs.existsSync(root) && fs.statSync(root).isDirectory();
  } catch {
    return false;
  }
}

/**
 * CLI 工作区根目录解析优先级：
 * 1. 执行环境 ft_execution_env.cli_workspace_root
 * 2. Egg config.fitnessExecution.fitnessAgentRoot（含 FITNESS_AGENT_ROOT）
 * 3. 常见 Docker 挂载路径自动检测
 */
function resolveFitnessAgentRoot(ctx, env = null) {
  const cfg = ctx?.app?.config?.fitnessExecution || {};
  const candidates = [
    env?.cli_workspace_root,
    cfg.fitnessAgentRoot,
    process.env.FITNESS_AGENT_ROOT,
    ...AUTO_DETECT_PATHS,
  ];
  for (const raw of candidates) {
    const root = String(raw || '').trim();
    if (pathLooksValid(root)) return path.resolve(root);
  }
  return '';
}

module.exports = {
  resolveFitnessAgentRoot,
  pathLooksValid,
  AUTO_DETECT_PATHS,
};
