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

module.exports = {
  parseGithubHttps,
  publicCloneUrl,
  cloneUrlWithToken,
  gitAuthEnv,
  assertGitTagName,
  parseLsRemoteRefSha,
  sameGitSha,
  resolveCodeSource,
  resolveGitBranch,
};
