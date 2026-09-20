'use strict';

const fs = require('fs');
const path = require('path');
const { resolveCliArgv, ensureAliyunPrefix, normalizeCodeLanguage } = require('./deployProducts');
const { applyLlmProfileToRuntime } = require('./deployLlmCatalog');

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

/**
 * 本地部署解析包目录。packagePath 为空时等同 resolveAgentrunSource；
 * 非空时优先 hint/packagePath，其次若 hint 本身已是该包根也可用。
 * @deprecated 包路径现指向预打 zip；保留供兼容旧配置。
 */
function resolveLocalPackageDir(project, packagePath) {
  const pkg = String(packagePath || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (!pkg) return resolveAgentrunSource(project);

  for (const hint of collectAgentrunSourceHints(project)) {
    const resolved = resolveSourcePath(hint);
    if (!resolved) continue;
    const nested = path.join(resolved, ...pkg.split('/'));
    if (hasAgentrunRunScript(nested)) return path.resolve(nested);
    if (hasAgentrunRunScript(resolved)) {
      const posix = resolved.replace(/\\/g, '/');
      if (posix === pkg || posix.endsWith(`/${pkg}`)) return path.resolve(resolved);
    }
  }
  return null;
}

function artifactZipTarget(repoDir) {
  return path.join(repoDir, 'deploy', 'agentrun', 'code-package', 'artifact.zip');
}

/** 在 source_path 下解析预打 zip：支持 backup/ss.zip，或目录内 artifact.zip / 唯一 *.zip */
function resolveLocalArtifactZip(project, packagePath) {
  const pkg = String(packagePath || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (!pkg) return null;

  for (const hint of collectAgentrunSourceHints(project)) {
    const root = resolveSourcePath(hint);
    if (!root) continue;
    if (/\.zip$/i.test(pkg)) {
      const file = path.join(root, ...pkg.split('/'));
      if (safeStat(file)?.isFile()) return path.resolve(file);
      continue;
    }
    const dir = path.join(root, ...pkg.split('/'));
    if (!safeStat(dir)?.isDirectory()) continue;
    const preferred = path.join(dir, 'artifact.zip');
    if (safeStat(preferred)?.isFile()) return path.resolve(preferred);
    let names = [];
    try {
      names = fs.readdirSync(dir).filter(name => /\.zip$/i.test(name));
    } catch {
      names = [];
    }
    if (names.length === 1) return path.resolve(dir, names[0]);
    if (names.includes('ss.zip')) return path.resolve(dir, 'ss.zip');
  }
  return null;
}

function placeArtifactZip(repoDir, zipPath) {
  const dest = artifactZipTarget(repoDir);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(zipPath, dest);
  return dest;
}

/** 已有 artifact.zip 时只跑 deploy.sh（跳过 pack，与本机「已有 zip 再 deploy」一致） */
function resolveDeployOnlyArgv(targetEnv) {
  const env = [ 'prod', 'test' ].includes(String(targetEnv)) ? targetEnv : 'prod';
  return [ 'bash', 'deploy/agentrun/code-package/scripts/deploy.sh', env ];
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

/** 复用已下载的 agentrun 组件，避免每次冷启动都打 registry（易被错误代理响应误伤）。 */
function seedAgentrunComponent(homeDir) {
  const dest = path.join(homeDir, '.s', 'components', 'devsapp.cn', 'v3', 'agentrun');
  const destEntry = path.join(dest, 'dist', 'index.js');
  if (fs.existsSync(destEntry)) return { seeded: false, reason: 'already-present' };

  const cacheRoot = process.env.OPS_AGENTRUN_COMPONENT_CACHE
    || path.join(process.env.OPS_DEPLOY_WORKDIR || path.join(require('os').tmpdir(), 'ops-deploy'), '_component-cache', 'agentrun');
  const cacheEntry = path.join(cacheRoot, 'dist', 'index.js');

  const candidates = [];
  if (fs.existsSync(cacheEntry)) candidates.push(cacheRoot);
  try {
    const workRoot = process.env.OPS_DEPLOY_WORKDIR || path.join(require('os').tmpdir(), 'ops-deploy');
    const jobs = fs.readdirSync(workRoot, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d+$/.test(d.name))
      .map(d => d.name)
      .sort((a, b) => Number(b) - Number(a));
    for (const id of jobs.slice(0, 8)) {
      const p = path.join(workRoot, id, '.ops-home', '.s', 'components', 'devsapp.cn', 'v3', 'agentrun');
      if (fs.existsSync(path.join(p, 'dist', 'index.js'))) candidates.push(p);
    }
  } catch {
    /* ignore */
  }

  const src = candidates[0];
  if (!src) return { seeded: false, reason: 'no-cache' };

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  try {
    if (!fs.existsSync(cacheEntry)) {
      fs.mkdirSync(path.dirname(cacheRoot), { recursive: true });
      fs.cpSync(src, cacheRoot, { recursive: true });
    }
  } catch {
    /* ignore cache warm */
  }
  return { seeded: true, from: src };
}

function envLines(agentrun) {
  const account = agentrun.account || {};
  const platform = agentrun.platform || {};
  const runtime = { ...(agentrun.runtime || {}) };
  applyLlmProfileToRuntime(runtime, runtime.LLM_DEFAULT_PROFILE);
  const envName = agentrun.target_env === 'test' ? 'test' : 'prod';
  const map = {
    DEPLOY_ENV: envName,
    DEPLOY_MODE: 'agentrun',
    SCHEME: 'code-package',
    CONFIG_SOURCE: 'deploy/config',
    CODE_LANGUAGE: normalizeCodeLanguage(platform.code_language),
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
  const componentSeed = seedAgentrunComponent(homeDir);
  return { alias, envName, map, argv, componentSeed };
}

module.exports = {
  resolveSourcePath,
  liftToAgentrunRoot,
  hasAgentrunRunScript,
  resolveAgentrunSource,
  resolveLocalPackageDir,
  resolveLocalArtifactZip,
  artifactZipTarget,
  placeArtifactZip,
  resolveDeployOnlyArgv,
  collectAgentrunSourceHints,
  copySource,
  writeAccessYaml,
  writeDotEnv,
  materialize,
  seedAgentrunComponent,
  envLines,
  ensureAliyunPrefix,
};
