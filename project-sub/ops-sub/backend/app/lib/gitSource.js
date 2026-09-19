'use strict';

function parseGithubHttps(url) {
  const raw = String(url || '').trim();
  const matched = raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!matched) return null;
  return {
    owner: matched[1],
    repo: matched[2].replace(/\.git$/i, ''),
  };
}

function publicCloneUrl(url) {
  const parsed = parseGithubHttps(url);
  if (!parsed) return String(url || '').trim();
  return `https://github.com/${parsed.owner}/${parsed.repo}.git`;
}

function cloneUrlWithToken(url, token) {
  const parsed = parseGithubHttps(url);
  const trimmed = String(url || '').trim();
  if (!parsed || !String(token || '').trim()) return trimmed;
  const safe = encodeURIComponent(String(token).trim());
  return `https://x-access-token:${safe}@github.com/${parsed.owner}/${parsed.repo}.git`;
}

function gitAuthEnv() {
  return {
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: 'echo',
    GIT_CONFIG_NOSYSTEM: '1',
  };
}

/** Alpine/Docker 下 Git↔GitHub 偶发 TLS EOF，强制 HTTP/1.1 更稳 */
function withGitHttpCompat(argv) {
  const list = Array.isArray(argv) ? [ ...argv ] : [];
  if (list[0] !== 'git') return list;
  const flags = [ '-c', 'http.version=HTTP/1.1' ];
  if (list.includes('http.version')) return list;
  return [ 'git', ...flags, ...list.slice(1) ];
}

function classifyGithubGitError(err) {
  const text = String(err && err.message || err || '');
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
  if (/^https?:\/\/github\.com\//i.test(String(repoUrl || '')) && tagName && tagName !== 'demo') {
    return 'github';
  }
  if (product === 'agentrun') return 'local';
  return 'github';
}

function resolveGitBranch(input) {
  const branch = String(input || '').trim();
  return branch || 'main';
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
  parseGithubHttps,
  publicCloneUrl,
  cloneUrlWithToken,
  gitAuthEnv,
  withGitHttpCompat,
  classifyGithubGitError,
  assertGitTagName,
  parseLsRemoteRefSha,
  sameGitSha,
  resolveCodeSource,
  resolveGitBranch,
  parseSemverTag,
  suggestNextReleaseTag,
};
