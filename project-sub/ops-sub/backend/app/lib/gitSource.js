'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 解析 GitHub 仓库地址（HTTPS 或 SSH）。
 * 支持：
 *   https://github.com/owner/repo.git
 *   git@github.com:owner/repo.git
 *   ssh://git@github.com/owner/repo.git
 * @returns {{ owner: string, repo: string, protocol: 'https'|'ssh' } | null}
 */
function parseGithubRepo(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;

  let matched = raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (matched) {
    return {
      owner: matched[1],
      repo: matched[2].replace(/\.git$/i, ''),
      protocol: 'https',
    };
  }

  matched = raw.match(/^git@github\.com:([^/]+)\/([^/#?]+)$/i);
  if (matched) {
    return {
      owner: matched[1],
      repo: matched[2].replace(/\.git$/i, ''),
      protocol: 'ssh',
    };
  }

  matched = raw.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/#?]+)$/i);
  if (matched) {
    return {
      owner: matched[1],
      repo: matched[2].replace(/\.git$/i, ''),
      protocol: 'ssh',
    };
  }

  return null;
}

/** @deprecated 兼容旧调用：任意可解析的 GitHub 地址都返回 owner/repo（含 SSH） */
function parseGithubHttps(url) {
  const parsed = parseGithubRepo(url);
  if (!parsed) return null;
  return { owner: parsed.owner, repo: parsed.repo };
}

function resolveGitProtocol(input, repoUrl) {
  const raw = String(input || '').trim().toLowerCase();
  if (raw === 'ssh' || raw === 'https') return raw;
  const parsed = parseGithubRepo(repoUrl);
  return parsed?.protocol === 'ssh' ? 'ssh' : 'https';
}

function formatGithubCloneUrl(parsed, protocol = 'https') {
  if (!parsed?.owner || !parsed?.repo) return '';
  if (protocol === 'ssh') {
    return `git@github.com:${parsed.owner}/${parsed.repo}.git`;
  }
  return `https://github.com/${parsed.owner}/${parsed.repo}.git`;
}

function publicCloneUrl(url, protocol) {
  const parsed = parseGithubRepo(url);
  if (!parsed) return String(url || '').trim();
  const proto = resolveGitProtocol(protocol, url);
  return formatGithubCloneUrl(parsed, proto);
}

/**
 * clone/fetch 用的远程地址。
 * HTTPS：带 PAT；SSH：纯 SSH URL（鉴权靠 GIT_SSH_COMMAND / 部署密钥）。
 */
function cloneUrlWithToken(url, token, protocol) {
  const parsed = parseGithubRepo(url);
  const proto = resolveGitProtocol(protocol, url);
  if (!parsed) return String(url || '').trim();
  if (proto === 'ssh') {
    return formatGithubCloneUrl(parsed, 'ssh');
  }
  const trimmed = formatGithubCloneUrl(parsed, 'https');
  if (!String(token || '').trim()) return trimmed;
  const safe = encodeURIComponent(String(token).trim());
  return `https://x-access-token:${safe}@github.com/${parsed.owner}/${parsed.repo}.git`;
}

function defaultSshDir(env = process.env) {
  return String(env.OPS_GIT_SSH_DIR || '/ops-git-ssh').trim().replace(/\/+$/, '') || '/ops-git-ssh';
}

function resolveSshKeyPath(env = process.env) {
  const explicit = String(env.OPS_GIT_SSH_KEY || '').trim();
  if (explicit) return explicit;
  const dir = defaultSshDir(env);
  const candidates = [ 'id_ed25519', 'id_rsa', 'id_ecdsa', 'deploy_key' ];
  for (const name of candidates) {
    const full = path.join(dir, name);
    if (fs.existsSync(full)) return full;
  }
  return '';
}

function resolveSshKnownHostsPath(env = process.env) {
  const explicit = String(env.OPS_GIT_SSH_KNOWN_HOSTS || '').trim();
  if (explicit) return explicit;
  const inDir = path.join(defaultSshDir(env), 'known_hosts');
  if (fs.existsSync(inDir)) return inDir;
  const baked = '/etc/ssh/github_known_hosts';
  if (fs.existsSync(baked)) return baked;
  return inDir;
}

function assertSshReady(env = process.env) {
  const key = resolveSshKeyPath(env);
  if (!key || !fs.existsSync(key)) {
    const err = new Error(
      `SSH 部署需要容器内可读的部署密钥。请挂载 OPS_GIT_SSH_MOUNT 到 ${defaultSshDir(env)}，并放置 id_ed25519（或设置 OPS_GIT_SSH_KEY）。`,
    );
    err.status = 400;
    throw err;
  }
  return {
    keyPath: key,
    knownHosts: resolveSshKnownHostsPath(env),
  };
}

/**
 * @param {{ protocol?: string }} [opts]
 */
function gitAuthEnv(opts = {}, env = process.env) {
  const base = {
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: 'echo',
    GIT_CONFIG_NOSYSTEM: '1',
  };
  const protocol = resolveGitProtocol(opts.protocol, opts.repoUrl);
  if (protocol !== 'ssh') return base;

  const { keyPath, knownHosts } = assertSshReady(env);
  // 路径勿含空格；GIT_SSH_COMMAND 由 git 直接 exec
  const cmd = [
    'ssh',
    '-i', keyPath,
    '-o', 'IdentitiesOnly=yes',
    '-o', `UserKnownHostsFile=${knownHosts}`,
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'BatchMode=yes',
  ].join(' ');
  return {
    ...base,
    GIT_SSH_COMMAND: cmd,
  };
}

/** Alpine/Docker 下 Git↔GitHub 偶发 TLS EOF，强制 HTTP/1.1 更稳；SSH 跳过 */
function withGitHttpCompat(argv, protocol) {
  const list = Array.isArray(argv) ? [ ...argv ] : [];
  if (list[0] !== 'git') return list;
  if (resolveGitProtocol(protocol) === 'ssh') return list;
  const flags = [ '-c', 'http.version=HTTP/1.1' ];
  if (list.includes('http.version')) return list;
  return [ 'git', ...flags, ...list.slice(1) ];
}

function classifyGithubGitError(err) {
  const text = String(err && err.message || err || '');
  if (/Could not resolve hostname|Network is unreachable|Connection timed out|Connection refused/i.test(text)) {
    return `访问 GitHub 网络失败。详情：${text}`;
  }
  if (/Host key verification failed/i.test(text)) {
    return `SSH known_hosts 未包含 github.com。请挂载 known_hosts 或使用镜像内置 /etc/ssh/github_known_hosts。详情：${text}`;
  }
  if (/Permission denied \(publickey\)|unable to authenticate/i.test(text)) {
    return `GitHub SSH 公钥鉴权失败。请确认部署密钥已加到该仓库（Deploy keys）或账号 SSH keys，且容器已挂载对应私钥。详情：${text}`;
  }
  if (/TLS|SSL|unexpected eof|gnutls|schannel|unable to access/i.test(text)) {
    return `访问 GitHub 时 TLS/网络失败（不是 Token 丢失）。容器到 github.com 链路不稳定时可重试。详情：${text}`;
  }
  if (/Authentication failed|Invalid username|403|401|Permission denied/i.test(text)) {
    return `GitHub 鉴权失败，请确认个人信息中的 PAT 有效且具有 repo 读（推送 tag 还需 Write）权限。详情：${text}`;
  }
  if (/could not read Username|terminal prompts disabled/i.test(text)) {
    return `Git 未带上 Token（或 Token 为空）。请到账号设置重新保存 PAT 后再部署。详情：${text}`;
  }
  return text;
}

function assertGitTagName(raw) {
  const tag = String(raw || '').trim();
  if (!tag || tag === 'source' || tag === 'demo') {
    const err = new Error('请填写本次发布 tag，例如 v0.0.2');
    err.status = 400;
    throw err;
  }
  if (tag.length > 128) {
    const err = new Error('tag 过长');
    err.status = 400;
    throw err;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-\/]*$/.test(tag)) {
    const err = new Error('tag 只能包含字母、数字、点、下划线、中划线或 /，例如 v0.0.2');
    err.status = 400;
    throw err;
  }
  return tag;
}

function parseLsRemoteRefSha(output, refName) {
  const needle = String(refName || '').trim();
  if (!needle) return '';
  const lines = String(output || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const peeled = lines.find(line => line.endsWith(`${needle}^{}`));
  const direct = lines.find(line => {
    const parts = line.split(/\s+/);
    return parts[1] === needle;
  });
  const row = peeled || direct;
  if (!row) return '';
  return row.split(/\s+/)[0] || '';
}

function sameGitSha(a, b) {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function resolveCodeSource(input, { product, tag, repoUrl } = {}) {
  const raw = String(input || '').trim().toLowerCase();
  if (raw === 'github' || raw === 'local') return raw;
  const tagName = String(tag || '').trim();
  if (tagName === 'source') return 'local';
  if (parseGithubRepo(repoUrl) && tagName && tagName !== 'demo') {
    return 'github';
  }
  if (product === 'agentrun') return 'local';
  return 'github';
}

function resolveGitBranch(input) {
  const branch = String(input || '').trim();
  return branch || 'main';
}

/**
 * 仓库内相对包路径：指向预打好的 .zip（如 backup/ss.zip），或含 zip 的目录。
 * 空表示不指定预打包，走本地 pack。禁止绝对路径与 ..。
 */
function normalizePackagePath(input) {
  let raw = String(input || '').trim().replace(/\\/g, '/');
  raw = raw.replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (!raw || raw === '.') return '';
  if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw) || raw.split('/').includes('..')) {
    const err = new Error('包路径须为仓库内相对路径，例如 backup/ss.zip 或 backup');
    err.status = 400;
    throw err;
  }
  if (raw.length > 512) {
    const err = new Error('包路径过长');
    err.status = 400;
    throw err;
  }
  return raw;
}

function isZipPackagePath(input) {
  return /\.zip$/i.test(String(input || '').trim());
}

function parseSemverTag(name) {
  const raw = String(name || '').trim();
  const matched = raw.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  if (!matched) return null;
  return {
    name: raw,
    major: Number(matched[1]),
    minor: Number(matched[2]),
    patch: Number(matched[3]),
    prefix: /^v/i.test(raw) ? (raw[0] === 'V' ? 'V' : 'v') : 'v',
  };
}

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function suggestNextReleaseTag(tagNames, fallback = 'v0.0.1') {
  const parsed = (Array.isArray(tagNames) ? tagNames : [])
    .map(item => parseSemverTag(typeof item === 'string' ? item : item && item.name))
    .filter(Boolean)
    .sort(compareSemver);
  if (!parsed.length) {
    return { latest_tag: '', next_tag: fallback };
  }
  const latest = parsed[parsed.length - 1];
  return {
    latest_tag: latest.name,
    next_tag: `${latest.prefix}${latest.major}.${latest.minor}.${latest.patch + 1}`,
  };
}

module.exports = {
  parseGithubRepo,
  parseGithubHttps,
  resolveGitProtocol,
  formatGithubCloneUrl,
  publicCloneUrl,
  cloneUrlWithToken,
  defaultSshDir,
  resolveSshKeyPath,
  resolveSshKnownHostsPath,
  assertSshReady,
  gitAuthEnv,
  withGitHttpCompat,
  classifyGithubGitError,
  assertGitTagName,
  parseLsRemoteRefSha,
  sameGitSha,
  resolveCodeSource,
  resolveGitBranch,
  normalizePackagePath,
  isZipPackagePath,
  parseSemverTag,
  suggestNextReleaseTag,
};
