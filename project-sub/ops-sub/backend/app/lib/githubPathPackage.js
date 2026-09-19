'use strict';

/**
 * 按仓库内相对路径拉取代码包（不落全仓）。
 * 走 GitHub Git Trees + Raw，只下载 package_path 下的 blob。
 */

const fs = require('fs');
const path = require('path');
const { normalizePackagePath, parseGithubHttps } = require('./gitSource');

const UA = 'ops-sub-deploy';
const API_VERSION = '2022-11-28';
/** 超过该大小的单文件输出字节进度 */
const LARGE_FILE_BYTES = 100 * 1024;
/** 大文件进度日志最小间隔 */
const LARGE_PROGRESS_STEP = 100 * 1024;

function githubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': UA,
    'X-GitHub-Api-Version': API_VERSION,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

async function githubJson(url, token, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...githubHeaders(token),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text.slice(0, 300) };
  }
  if (!res.ok) {
    const msg = data?.message || text.slice(0, 300) || `HTTP ${res.status}`;
    const err = new Error(`GitHub API ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function resolveCommitSha({ owner, repo, ref, token }) {
  const encoded = encodeURIComponent(String(ref || '').trim());
  const data = await githubJson(
    `https://api.github.com/repos/${owner}/${repo}/commits/${encoded}`,
    token,
  );
  const sha = String(data?.sha || '').trim();
  if (!sha) throw new Error(`无法解析 ref ${ref} 的 commit SHA`);
  return sha;
}

async function createLightweightTag({ owner, repo, tag, sha, token }) {
  await githubJson(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    token,
    {
      method: 'POST',
      body: { ref: `refs/tags/${tag}`, sha },
    },
  );
}

async function listPathBlobs({ owner, repo, commitSha, packagePath, token }) {
  const commit = await githubJson(
    `https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`,
    token,
  );
  const treeSha = commit?.tree?.sha;
  if (!treeSha) throw new Error('无法读取 commit tree');

  const tree = await githubJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
    token,
  );
  if (tree.truncated) {
    throw new Error('仓库文件树过大（GitHub truncated），请改用更小的包路径或联系管理员');
  }
  const prefix = `${packagePath}/`;
  const blobs = (Array.isArray(tree.tree) ? tree.tree : []).filter(item => (
    item
    && item.type === 'blob'
    && typeof item.path === 'string'
    && (item.path === packagePath || item.path.startsWith(prefix))
  ));
  if (!blobs.length) {
    throw new Error(`包路径下没有可下载文件：${packagePath}（请确认路径相对仓库根，且已推到目标分支/tag）`);
  }
  return blobs;
}

function relPathUnderPackage(blobPath, packagePath) {
  if (blobPath === packagePath) return path.basename(packagePath);
  const prefix = `${packagePath}/`;
  if (blobPath.startsWith(prefix)) return blobPath.slice(prefix.length);
  return blobPath;
}

/**
 * @param {{ knownSize?: number, onByteProgress?: (received: number, total: number) => (void|Promise<void>) }} [opts]
 */
async function downloadRawFile({
  owner,
  repo,
  commitSha,
  filePath,
  token,
  knownSize = 0,
  onByteProgress,
} = {}) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${filePath.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`下载 ${filePath} 失败：HTTP ${res.status}`);
  }

  const headerLen = Number(res.headers.get('content-length') || 0);
  const totalHint = headerLen || Number(knownSize) || 0;
  const trackLarge = totalHint >= LARGE_FILE_BYTES
    || (typeof onByteProgress === 'function' && Number(knownSize) >= LARGE_FILE_BYTES);

  if (!trackLarge || !res.body || typeof res.body.getReader !== 'function') {
    return Buffer.from(await res.arrayBuffer());
  }

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  let lastReported = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    chunks.push(chunk);
    received += chunk.length;
    const crossed = received - lastReported >= LARGE_PROGRESS_STEP;
    const finishedHint = totalHint > 0 && received >= totalHint;
    if (typeof onByteProgress === 'function' && (crossed || finishedHint)) {
      lastReported = received;
      await onByteProgress(received, totalHint);
    }
  }
  if (typeof onByteProgress === 'function' && received > lastReported) {
    await onByteProgress(received, totalHint || received);
  }
  return Buffer.concat(chunks);
}

async function mapPool(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(concurrency || 8, list.length || 1));
  let cursor = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      await worker(list[index], index);
    }
  });
  await Promise.all(runners);
}

/**
 * 将 package_path 下的文件落到 destDir 根（已 hoist）。
 * @returns {{ sha: string, fileCount: number, packagePath: string }}
 */
async function downloadGithubPathPackage({
  repoUrl,
  ref,
  packagePath,
  token,
  destDir,
  onProgress,
  exclude,
} = {}) {
  const parsed = parseGithubHttps(repoUrl);
  if (!parsed) throw new Error('仅支持 GitHub HTTPS 仓库按路径拉取');
  const pkg = normalizePackagePath(packagePath);
  if (!pkg) throw new Error('按路径拉取需要 package_path');
  const { owner, repo } = parsed;
  const commitSha = await resolveCommitSha({ owner, repo, ref, token });
  let blobs = await listPathBlobs({ owner, repo, commitSha, packagePath: pkg, token });
  if (typeof exclude === 'function') {
    blobs = blobs.filter(blob => !exclude(blob.path));
  }
  if (!blobs.length) {
    throw new Error(`包路径下没有可下载文件：${pkg}`);
  }

  const total = blobs.length;
  const largeCount = blobs.filter(b => Number(b.size || 0) >= LARGE_FILE_BYTES).length;
  if (typeof onProgress === 'function') {
    await onProgress(
      `包路径 ${pkg}：共 ${total} 个文件`
      + (largeCount ? `（其中 ${largeCount} 个 ≥ ${formatBytes(LARGE_FILE_BYTES)}）` : '')
      + '，开始下载',
    );
  }

  fs.mkdirSync(destDir, { recursive: true });
  let done = 0;
  await mapPool(blobs, 8, async (blob) => {
    const rel = relPathUnderPackage(blob.path, pkg);
    if (!rel || rel.split(/[/\\]/).includes('..')) {
      throw new Error(`非法文件路径：${blob.path}`);
    }
    const out = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const knownSize = Number(blob.size || 0);
    const isLarge = knownSize >= LARGE_FILE_BYTES;
    if (isLarge && typeof onProgress === 'function') {
      await onProgress(`大文件开始 ${blob.path}（约 ${formatBytes(knownSize)}）`);
    }
    const buf = await downloadRawFile({
      owner,
      repo,
      commitSha,
      filePath: blob.path,
      token,
      knownSize,
      onByteProgress: isLarge && typeof onProgress === 'function'
        ? async (received, totalBytes) => {
          const suffix = totalBytes
            ? ` / ${formatBytes(totalBytes)}`
            : '';
          await onProgress(`大文件 ${blob.path}：已下载 ${formatBytes(received)}${suffix}`);
        }
        : undefined,
    });
    fs.writeFileSync(out, buf);
    done += 1;
    if (typeof onProgress === 'function') {
      await onProgress(`进度 ${done}/${total}：${blob.path}（${formatBytes(buf.length)}）`);
    }
  });

  return { sha: commitSha, fileCount: blobs.length, packagePath: pkg };
}

/**
 * 下载仓库内单个文件（用于预打 artifact zip）。
 */
async function downloadGithubFile({
  repoUrl,
  ref,
  filePath,
  token,
  destFile,
  onProgress,
} = {}) {
  const parsed = parseGithubHttps(repoUrl);
  if (!parsed) throw new Error('仅支持 GitHub HTTPS 仓库按路径拉取');
  const pkg = normalizePackagePath(filePath);
  if (!pkg) throw new Error('缺少文件路径');
  const { owner, repo } = parsed;
  const commitSha = await resolveCommitSha({ owner, repo, ref, token });
  if (typeof onProgress === 'function') {
    await onProgress(`下载 ${pkg} @ ${commitSha.slice(0, 12)}`);
  }
  const buf = await downloadRawFile({
    owner,
    repo,
    commitSha,
    filePath: pkg,
    token,
    knownSize: LARGE_FILE_BYTES,
    onByteProgress: typeof onProgress === 'function'
      ? async (received, totalBytes) => {
        const suffix = totalBytes ? ` / ${formatBytes(totalBytes)}` : '';
        await onProgress(`大文件 ${pkg}：已下载 ${formatBytes(received)}${suffix}`);
      }
      : undefined,
  });
  if (!buf.length || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error(`下载内容不是 zip 文件：${pkg}`);
  }
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, buf);
  return { sha: commitSha, bytes: buf.length, filePath: pkg };
}

/**
 * 在目录路径下选出要部署的 zip（优先 artifact.zip，其次唯一 *.zip）。
 */
async function resolveGithubZipFilePath({
  repoUrl,
  ref,
  packagePath,
  token,
} = {}) {
  const pkg = normalizePackagePath(packagePath);
  if (!pkg) throw new Error('缺少包路径');
  if (/\.zip$/i.test(pkg)) return pkg;

  const parsed = parseGithubHttps(repoUrl);
  const commitSha = await resolveCommitSha({
    owner: parsed.owner,
    repo: parsed.repo,
    ref,
    token,
  });
  const blobs = await listPathBlobs({
    owner: parsed.owner,
    repo: parsed.repo,
    commitSha,
    packagePath: pkg,
    token,
  });
  const zips = blobs
    .map(item => item.path)
    .filter(p => /\.zip$/i.test(p));
  const artifact = zips.find(p => /(^|\/)artifact\.zip$/i.test(p));
  if (artifact) return artifact;
  if (zips.length === 1) return zips[0];
  const ss = zips.find(p => /(^|\/)ss\.zip$/i.test(p));
  if (ss) return ss;
  if (!zips.length) {
    throw new Error(`包路径 ${pkg} 下没有 .zip；请填 backup/ss.zip 这类文件路径`);
  }
  throw new Error(`包路径 ${pkg} 下有多个 zip（${zips.map(p => path.posix.basename(p)).join(', ')}），请直接填具体文件路径`);
}

module.exports = {
  downloadGithubPathPackage,
  downloadGithubFile,
  resolveGithubZipFilePath,
  createLightweightTag,
  resolveCommitSha,
  LARGE_FILE_BYTES,
};
