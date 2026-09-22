'use strict';

/**
 * ECS GitHub 镜像仓：与 admin-management-station 同级，按仓库名落盘。
 * 仅 OPS_GIT_MIRROR_ENABLED=1 时启用；本地 code_source=local 不受影响。
 *
 * 宿主机示例：/opt/project/admin-management-station
 *            /opt/project/fitness-agent   ← 镜像
 * 容器内：    /host-mirrors/fitness-agent（OPS_GIT_MIRROR_MOUNT → /host-mirrors）
 *
 * clone/fetch 支持 HTTPS+PAT 或 SSH 部署密钥（由 protocol 决定）。
 */

const fs = require('fs');
const path = require('path');
const {
  parseGithubRepo,
  publicCloneUrl,
  cloneUrlWithToken,
  resolveGitProtocol,
} = require('./gitSource');

function isEnabled(env = process.env) {
  const raw = String(env.OPS_GIT_MIRROR_ENABLED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** 容器内镜像根，默认 /host-mirrors */
function mirrorRoot(env = process.env) {
  return String(env.OPS_GIT_MIRROR_ROOT || '/host-mirrors').trim().replace(/\/+$/, '') || '/host-mirrors';
}

function repoNameFromUrl(repoUrl) {
  const parsed = parseGithubRepo(repoUrl);
  if (!parsed?.repo) {
    const err = new Error('无法从仓库地址解析项目名（需要 https://github.com/org/repo.git 或 git@github.com:org/repo.git）');
    err.status = 400;
    throw err;
  }
  return parsed.repo;
}

function mirrorRepoDir(repoUrl, env = process.env) {
  return path.join(mirrorRoot(env), repoNameFromUrl(repoUrl));
}

function assertMirrorRootWritable(env = process.env) {
  const root = mirrorRoot(env);
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.accessSync(root, fs.constants.W_OK);
  } catch (err) {
    throw new Error(
      `Git 镜像根不可写：${root}。ECS 请将 OPS_GIT_MIRROR_MOUNT 设为与 admin-management-station 同级目录（如 /opt/project），并挂载到容器 ${root}（rw）。详情：${err.message}`,
    );
  }
}

/**
 * 确保镜像仓存在并切到指定 ref（tag 或分支）。
 * @param {{ repoUrl: string, ref: string, token: string, protocol?: string, runGit: Function, onLog?: Function }} opts
 *   runGit(argv, cwd) — 执行 git（可带超时/日志）
 */
async function ensureMirror(opts) {
  const {
    repoUrl,
    ref,
    token,
    protocol,
    runGit,
    onLog = () => {},
    env = process.env,
  } = opts;

  if (!isEnabled(env)) {
    throw new Error('Git 镜像未启用（OPS_GIT_MIRROR_ENABLED≠1）');
  }
  assertMirrorRootWritable(env);

  const parsed = parseGithubRepo(repoUrl);
  if (!parsed) {
    throw new Error('无法解析 GitHub 仓库地址');
  }
  const proto = resolveGitProtocol(protocol, repoUrl);
  const dest = mirrorRepoDir(repoUrl, env);
  const publicUrl = publicCloneUrl(repoUrl, proto);
  const authUrl = cloneUrlWithToken(repoUrl, token, proto);
  const gitDir = path.join(dest, '.git');
  const parent = path.dirname(dest);

  fs.mkdirSync(parent, { recursive: true });

  if (!fs.existsSync(gitDir)) {
    if (fs.existsSync(dest) && fs.readdirSync(dest).length) {
      throw new Error(
        `同级目录已存在但不是 git 仓库：${dest}。请清空或改名后再部署，避免覆盖非镜像内容。`,
      );
    }
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    onLog(`[mirror] 首次克隆（${proto}） ${parsed.owner}/${parsed.repo} → ${dest}`);
    await runGit([ 'git', 'clone', authUrl, dest ], parent);
    await runGit([ 'git', 'remote', 'set-url', 'origin', publicUrl ], dest);
  } else {
    onLog(`[mirror] 增量更新（${proto}） ${dest}（fetch + checkout ${ref}）`);
    await runGit([ 'git', 'remote', 'set-url', 'origin', authUrl ], dest);
    try {
      await runGit([ 'git', 'fetch', '--tags', '--force', '--prune', 'origin' ], dest);
    } finally {
      await runGit([ 'git', 'remote', 'set-url', 'origin', publicUrl ], dest).catch(() => {});
    }
  }

  // 切到 tag/分支；失败时尝试 origin/ref
  try {
    await runGit([ 'git', 'checkout', '-f', ref ], dest);
  } catch {
    await runGit([ 'git', 'checkout', '-f', `origin/${ref}` ], dest);
  }

  const sha = String(await runGit([ 'git', 'rev-parse', 'HEAD' ], dest, { capture: true })).trim();
  onLog(`[mirror] 就绪 ${parsed.repo}@${ref} sha=${sha.slice(0, 12)}`);
  return {
    repoDir: dest,
    repoName: parsed.repo,
    owner: parsed.owner,
    sha: sha.slice(0, 40),
    mirrorRoot: mirrorRoot(env),
    protocol: proto,
  };
}

/** 从镜像仓取相对路径文件（package_path / deploy 脚手架） */
function resolveUnderMirror(repoDir, relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (!rel || rel.includes('..')) return null;
  const full = path.join(repoDir, ...rel.split('/'));
  return fs.existsSync(full) ? full : null;
}

module.exports = {
  isEnabled,
  mirrorRoot,
  repoNameFromUrl,
  mirrorRepoDir,
  ensureMirror,
  resolveUnderMirror,
  assertMirrorRootWritable,
};
