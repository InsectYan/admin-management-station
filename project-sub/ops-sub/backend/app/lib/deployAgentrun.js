'use strict';

const fs = require('fs');
const path = require('path');
const { resolveCliArgv, ensureAliyunPrefix } = require('./deployProducts');

function safeStat(target) {
  try {
    return fs.statSync(target);
  } catch {
    return null;
  }
}

function pushCandidate(list, value) {
  if (!value) return;
  const text = String(value).trim();
  if (text) list.push(text);
}

function resolveSourcePath(sourcePath) {
  const input = String(sourcePath || '').trim();
  if (!input || /^https?:\/\//i.test(input)) return null;
  const hostRoot = process.env.HOST_PROJECTS_ROOT || '/host-projects';
  const candidates = [];
  const normalized = input.replace(/\\/g, '/').replace(/\/+$/, '');
  pushCandidate(candidates, path.resolve(input));
  pushCandidate(candidates, normalized);
  const afterProjects = normalized.match(/\/projects\/(.+)$/i);
  if (afterProjects) pushCandidate(candidates, path.posix.join(hostRoot, afterProjects[1]));
  const afterFitness = normalized.match(/(?:^|\/)(fitness\/.+)$/i);
  if (afterFitness) pushCandidate(candidates, path.posix.join(hostRoot, afterFitness[1]));
  const drive = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (drive) {
    pushCandidate(candidates, `/mnt/${drive[1].toLowerCase()}/${drive[2]}`);
    pushCandidate(candidates, path.posix.join(hostRoot, drive[2]));
  }
  if (!path.isAbsolute(normalized) && !/^[A-Za-z]:/.test(input)) {
    pushCandidate(candidates, path.posix.join(hostRoot, normalized.replace(/^\/+/, '')));
  }
  if (normalized.startsWith('/host-projects/')) pushCandidate(candidates, normalized);
  const seen = new Set();
  for (const candidate of candidates) {
    const abs = path.resolve(candidate);
    if (seen.has(abs)) continue;
    seen.add(abs);
    const stat = safeStat(abs);
    if (stat && stat.isDirectory()) return abs;
  }
  return null;
}

function collectAgentrunSourceHints(project) {
  const extra = project?.extra_json && typeof project.extra_json === 'object' ? project.extra_json : {};
  const agentrun = project?.deploy_config?.agentrun && typeof project.deploy_config.agentrun === 'object'
    ? project.deploy_config.agentrun
    : {};
  return [
    project?.source_path,
    extra.source_path,
    agentrun.source_path,
    project?.repo_url,
  ];
}

function hasAgentrunRunScript(dir) {
  return !!dir && fs.existsSync(path.join(dir, 'deploy', 'scripts', 'run.mjs'));
}

function liftToAgentrunRoot(dir) {
  if (!dir) return null;
  let current = dir;
  for (let i = 0; i < 4; i++) {
    if (hasAgentrunRunScript(current)) return current;
    const parent = path.dirname(current);
    if (!parent || parent === current) break;
    current = parent;
  }
  return dir;
}

function resolveAgentrunSource(project) {
  for (const hint of collectAgentrunSourceHints(project)) {
    const resolved = resolveSourcePath(hint);
    if (resolved) return liftToAgentrunRoot(resolved);
  }
  return null;
}

function shouldSkipCopy(src) {
  const posix = src.replace(/\\/g, '/');
  return /\/(node_modules|\.git|artifact|backups|dist)(\/|$)/i.test(posix)
    || /artifact\.zip$/i.test(posix);
}

function copySource(from, to) {
  fs.cpSync(from, to, {
    recursive: true,
    filter: src => !shouldSkipCopy(src),
  });
}

function writeAccessYaml(homeDir, account) {
  const alias = String(account.sd_access || 'default').trim() || 'default';
  const yaml = `${alias}:\n  AccountID: "${account.account_id}"\n  AccessKeyID: "${account.access_key_id}"\n  AccessKeySecret: "${account.access_key_secret}"\n`;
  const dir = path.join(homeDir, '.s');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'access.yaml'), yaml, 'utf8');
  return alias;
}

function envLines(agentrun) {
  const account = agentrun.account || {};
  const platform = agentrun.platform || {};
  const runtime = agentrun.runtime || {};
  const envName = agentrun.target_env === 'test' ? 'test' : 'prod';
  const map = {
    DEPLOY_ENV: envName,
    DEPLOY_MODE: 'agentrun',
    SCHEME: 'code-package',
    CONFIG_SOURCE: 'deploy/config',
    CODE_LANGUAGE: platform.code_language || 'nodejs20',
    SD_ACCESS: account.sd_access || 'fitness-prod',
    AGENTRUN_REGION: platform.region || '',
    AGENT_NAME: platform.agent_name || '',
    ENDPOINT_NAME: platform.endpoint_name || '',
    AGENTRUN_WORKSPACE_ID: platform.workspace_id || '',
    AGENT_BASE_URL: platform.agent_base_url || '',
    VPC_ID: ensureAliyunPrefix(platform.vpc_id, 'vpc-'),
    VSWITCH_ID: ensureAliyunPrefix(platform.vswitch_id, 'vsw-'),
    SECURITY_GROUP_ID: ensureAliyunPrefix(platform.security_group_id, 'sg-'),
    NAS_SERVER_ADDR: platform.nas_server_addr || '',
    LOG_PROJECT: platform.log_project || '',
    LOG_STORE: platform.log_store || '',
    ...runtime,
  };
  if (map.DATABASE_URL && !map.AGENT_DATABASE_URL) map.AGENT_DATABASE_URL = map.DATABASE_URL;
  return { envName, map };
}

function writeDotEnv(repoDir, agentrun) {
  const { envName, map } = envLines(agentrun);
  const destDir = path.join(repoDir, 'deploy', 'config');
  fs.mkdirSync(destDir, { recursive: true });
  const body = Object.entries(map)
    .filter(([ , value ]) => value != null && String(value).trim() !== '')
    .map(([ key, value ]) => `${key}=${String(value)}`)
    .join('\n') + '\n';
  fs.writeFileSync(path.join(destDir, `.env.${envName}`), body, 'utf8');
  return { envName, map };
}

function materialize(repoDir, homeDir, agentrun) {
  const alias = writeAccessYaml(homeDir, agentrun.account || {});
  const { envName, map } = writeDotEnv(repoDir, agentrun);
  const argv = resolveCliArgv(agentrun.cli_command, envName);
  return { alias, envName, map, argv };
}

module.exports = {
  resolveSourcePath,
  liftToAgentrunRoot,
  hasAgentrunRunScript,
  resolveAgentrunSource,
  collectAgentrunSourceHints,
  copySource,
  writeAccessYaml,
  writeDotEnv,
  materialize,
  envLines,
  ensureAliyunPrefix,
};
