'use strict';

/**
 * ECS GitHub 镜像仓：与 admin-management-station 同级，按仓库名落盘。
 * 仅 OPS_GIT_MIRROR_ENABLED=1 时启用；本地 code_source=local 不受影响。
 *
 * 宿主机 / 容器路径须一致（compose：MOUNT → ROOT）：
 *   ECS：  OPS_GIT_MIRROR_MOUNT=/opt/project
 *          OPS_GIT_MIRROR_ROOT=/opt/project
 *          → 容器内 /opt/project/fitness-agent 即宿主机同名目录
 *   本地： OPS_GIT_MIRROR_MOUNT=../.ops-git-mirrors
 *          OPS_GIT_MIRROR_ROOT=/host-mirrors
 *
 * clone/fetch 支持 HTTPS+PAT 或 SSH 部署密钥（由 protocol 决定）。
 * 已存在且 HEAD 已是目标 ref 时跳过 fetch。
 */

const fs = require('fs');
const path = require('path');
const {
  parseGithubRepo,
  publicCloneUrl,
  cloneUrlWithToken,
  resolveGitProtocol,
  sameGitSha,
} = require('./gitSource');

function isEnabled(env = process.env) {
  const raw = String(env.OPS_GIT_MIRROR_ENABLED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** 容器内镜像根，默认 /host-mirrors；ECS 应设为 /opt/project 并与 MOUNT 一致 */
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

/**
 * 常见误配：ROOT=/opt/project 但 compose 仍把宿主机挂到 /host-mirrors。
 * 此时容器里的 /opt/project 不是 ECS 上的同级工程目录。
 */
function assertMirrorMountSane(env = process.env) {
  const root = mirrorRoot(env);
  const legacy = '/host-mirrors';
  if (root === legacy) return;

  try {
    if (!fs.existsSync(legacy)) return;
    const legacyEntries = fs.readdirSync(legacy).filter(name => !name.startsWith('.'));
    if (!legacyEntries.length) return;

    const rootHasSibling = legacyEntries.some(name => fs.existsSync(path.join(root, name, '.git')));
    const legacyHasSibling = legacyEntries.some(name => fs.existsSync(path.join(legacy, name, '.git')));
    if (!rootHasSibling && legacyHasSibling) {
      throw new Error(
        `镜像挂载不一致：OPS_GIT_MIRROR_ROOT=${root}，但宿主机工程实际出现在容器 ${legacy}/（含 ${legacyEntries.slice(0, 5).join(', ')}）。`
        + `请把 compose 挂载改为 \${OPS_GIT_MIRROR_MOUNT}:\${OPS_GIT_MIRROR_ROOT}，`
        + `ECS 推荐 MOUNT=/opt/project 且 ROOT=/opt/project 后 recreate 容器。`,
      );
    }
  } catch (err) {
    if (/镜像挂载不一致/.test(err.message)) throw err;
  }
}

function assertMirrorRootWritable(env = process.env) {
  const root = mirrorRoot(env);
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.accessSync(root, fs.constants.W_OK);
  } catch (err) {
    throw new Error(
      `Git 镜像根不可写：${root}。ECS 请设 OPS_GIT_MIRROR_MOUNT=/opt/project 与 OPS_GIT_MIRROR_ROOT=/opt/project（compose 挂载为二者互指）。详情：${err.message}`,
    );
  }
  assertMirrorMountSane(env);
}

async function resolveLocalRefSha(runGit, dest, ref) {
  try {
    const sha = String(await runGit([ 'git', 'rev-parse', `${ref}^{commit}` ], dest, { capture: true })).trim();
    return sha || '';
  } catch {
    try {
      const sha = String(await runGit([ 'git', 'rev-parse', ref ], dest, { capture: true })).trim();
      return sha || '';
    } catch {
      return '';
    }
  }
}

/**
 * 确保镜像仓存在并切到指定 ref（tag 或分支）。
 * @param {{ repoUrl: string, ref: string, token: string, protocol?: string, expectedSha?: string, runGit: Function, onLog?: Function }} opts
 */
async function ensureMirror(opts) {
  const {
    repoUrl,
    ref,
    token,
    protocol,
    expectedSha = '',
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
  const root = mirrorRoot(env);

  onLog(`[mirror] 根目录 ${root}（容器内路径；须已挂载宿主机同级工程根）→ 目标 ${dest}`);

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
    const localSha = await resolveLocalRefSha(runGit, dest, ref);
    const headSha = String(await runGit([ 'git', 'rev-parse', 'HEAD' ], dest, { capture: true })).trim();
    const want = String(expectedSha || localSha || '').trim();
    const alreadyOk = want
      && localSha
      && sameGitSha(localSha, want)
      && sameGitSha(headSha, want);

    if (alreadyOk) {
      onLog(`[mirror] 已是目标 ${ref}（sha=${headSha.slice(0, 12)}），跳过 fetch，直接取包部署`);
    } else {
      onLog(`[mirror] 需要更新（${proto}） ${dest}：当前 HEAD=${headSha.slice(0, 12) || '?'} → ${ref}${want ? ` (${want.slice(0, 12)})` : ''}`);
      await runGit([ 'git', 'remote', 'set-url', 'origin', authUrl ], dest);
      try {
        await runGit([ 'git', 'fetch', '--tags', '--force', '--prune', 'origin' ], dest);
      } finally {
        await runGit([ 'git', 'remote', 'set-url', 'origin', publicUrl ], dest).catch(() => {});
      }
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
    mirrorRoot: root,
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

/** 列目录便于 zip 缺失排障 */
function listDirHint(dir, limit = 12) {
  try {
    if (!fs.existsSync(dir)) return `目录不存在：${dir}`;
    const names = fs.readdirSync(dir).slice(0, limit);
    return names.length ? `目录 ${dir} 含：${names.join(', ')}` : `目录为空：${dir}`;
  } catch (err) {
    return `无法读取 ${dir}：${err.message}`;
  }
}

module.exports = {
  isEnabled,
  mirrorRoot,
  repoNameFromUrl,
  mirrorRepoDir,
  ensureMirror,
  resolveUnderMirror,
  assertMirrorRootWritable,
  assertMirrorMountSane,
  listDirHint,
};
