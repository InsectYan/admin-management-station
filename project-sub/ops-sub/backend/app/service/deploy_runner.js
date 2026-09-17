'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Service } = require('egg');
const { splitAndParse } = require('../lib/deployCommand');
const { track, untrack, kill } = require('../lib/deployProcesses');
const { isAgentrun } = require('../lib/deployProducts');
const agentrun = require('../lib/deployAgentrun');
const { redactDeployLog } = require('../lib/deployLogRedact');
const menuMaster = require('../lib/menuMaster');
const { publicCloneUrl, cloneUrlWithToken, gitAuthEnv, resolveCodeSource, parseLsRemoteRefSha, sameGitSha, assertGitTagName } = require('../lib/gitSource');

const KEEP = 5;

class DeployRunnerService extends Service {
  workRoot() {
    return process.env.OPS_DEPLOY_WORKDIR || path.join(os.tmpdir(), 'ops-deploy');
  }

  workDir(jobId) {
    return path.join(this.workRoot(), String(jobId));
  }

  kill(jobId) {
    return kill(jobId);
  }

  async run(jobId) {
    const deploy = this.ctx.service.deploy;
    let job = await deploy.getJob(jobId);
    if (job.status !== 'queued') return;

    const claimed = await deploy.claimRunning(jobId);
    if (!claimed) return;
    job = await deploy.getJob(jobId);

    const dir = this.workDir(jobId);
    try {
      const product = job.params?.product || 'generic';
      if (!isAgentrun(product)) this.parseBuild(job);
      await this.append(jobId, 'info', `[claim] 领取任务，产品 ${product}，工作区 ${dir}`);
      const sha = await this.prepareRepo(job, dir);
      if (!(await this.stillRunning(jobId))) return;
      await deploy.patchStatus(jobId, { git_sha: sha });
      if (isAgentrun(product)) {
        await this.runAgentrun(job, dir);
      } else {
        await this.build(job, dir);
        if (!(await this.stillRunning(jobId))) return;
        await this.check(job, dir);
      }
      if (!(await this.stillRunning(jobId))) return;
      await deploy.patchStatus(jobId, { status: 'success', finished_at: new Date() });
      await this.append(jobId, 'info', '[done] 部署完成');
    } catch (err) {
      if (!(await this.stillRunning(jobId))) return;
      await this.append(jobId, 'error', err.message);
      await deploy.patchStatus(jobId, {
        status: 'failed',
        finished_at: new Date(),
        error_summary: err.message.slice(0, 500),
      });
    } finally {
      this.pruneWorkspaces();
    }
  }

  async stillRunning(jobId) {
    const job = await this.ctx.service.deploy.getJob(jobId);
    return job.status === 'running';
  }

  async append(jobId, level, message) {
    await this.ctx.service.deploy.appendLog(jobId, { level, message });
  }

  async prepareRepo(job, dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const remote = String(job.git_remote || job.project?.repo_url || '').trim();
    const tag = job.git_tag;
    const product = job.params?.product || 'generic';
    const codeSource = resolveCodeSource(job.params?.code_source || job.params?.deploy_config?.code_source, {
      product,
      tag,
      repoUrl: remote,
    });
    if (codeSource === 'github') {
      return this.prepareGithubRepo(job, dir, remote, tag);
    }
    if (isAgentrun(product) || codeSource === 'local') {
      const source = agentrun.resolveAgentrunSource(job.project);
      if (!source) {
        throw new Error('本地部署需要容器可见的 source_path（挂 HOST_PROJECTS_ROOT，且能走到含 deploy/scripts/run.mjs 的仓库根）');
      }
      await this.append(job.id, 'info', `[source] 复制本地工程 ${source}`);
      agentrun.copySource(source, dir);
      return 'source';
    }
    throw new Error('无法准备代码：请选择本地 source_path 或 GitHub HTTPS + tag');
  }

  async resolveGithubToken(job) {
    let token = '';
    try {
      const cred = await menuMaster.readGithubTokenByUsername(job.triggered_by);
      token = cred?.token || '';
    } catch (err) {
      throw new Error(`读取 GitHub Token 失败：${err.message}`);
    }
    if (!token) token = process.env.OPS_GIT_TOKEN || '';
    if (!token) {
      throw new Error('未配置 GitHub Token，无法拉取仓库');
    }
    return token;
  }

  async prepareGithubRepo(job, dir, remote, rawTag) {
    if (!/^https?:\/\/github\.com\//i.test(remote)) {
      throw new Error('GitHub 部署需要 HTTPS 仓库地址');
    }
    const tag = assertGitTagName(rawTag);
    const branch = job.params?.git_branch || job.params?.deploy_config?.git_branch || 'main';
    const token = await this.resolveGithubToken(job);
    const publicUrl = publicCloneUrl(remote);
    const authUrl = cloneUrlWithToken(remote, token);
    const gitTimeout = Number(process.env.OPS_DEPLOY_GIT_TIMEOUT_MS || 5 * 60 * 1000);
    const authEnv = gitAuthEnv();

    await this.append(job.id, 'info', `[github] 仓库 ${publicUrl}，分支 ${branch}，发布 tag ${tag}`);

    let branchSha = '';
    let tagSha = '';
    try {
      const branchOut = await this.execCapture(
        job.id,
        [ 'git', 'ls-remote', authUrl, `refs/heads/${branch}` ],
        path.dirname(dir),
        authEnv,
      );
      branchSha = parseLsRemoteRefSha(branchOut, `refs/heads/${branch}`);
      const tagOut = await this.execCapture(
        job.id,
        [ 'git', 'ls-remote', '--tags', authUrl, `refs/tags/${tag}` ],
        path.dirname(dir),
        authEnv,
      );
      tagSha = parseLsRemoteRefSha(tagOut, `refs/tags/${tag}`);
    } catch (err) {
      throw new Error(`无法访问 GitHub 仓库（鉴权或网络失败）。请确认 PAT 有 repo 读权限。${err.message}`);
    }
    if (!branchSha) {
      throw new Error(`远程不存在分支 ${branch}，请先把代码推到该分支`);
    }

    if (tagSha && sameGitSha(tagSha, branchSha)) {
      await this.append(job.id, 'info', `[github] tag ${tag} 已指向 ${branch} HEAD，直接克隆`);
      await this.cloneByRef(job.id, authUrl, tag, dir, gitTimeout, authEnv, publicUrl);
    } else if (tagSha && !sameGitSha(tagSha, branchSha)) {
      throw new Error(
        `远程已有 tag ${tag}，但指向的提交与 ${branch} HEAD 不同。请换一个新 tag 名再部署，避免覆盖已有发布点。`,
      );
    } else {
      await this.append(job.id, 'info', `[github] 远程尚无 tag ${tag}，将在 ${branch} HEAD 创建并推送`);
      await this.cloneByRef(job.id, authUrl, branch, dir, gitTimeout, authEnv, publicUrl);
      try {
        await this.exec(
          job.id,
          [ 'git', '-c', 'user.name=ops-sub', '-c', 'user.email=ops-sub@local', 'tag', '-a', tag, '-m', `ops-sub deploy #${job.id}` ],
          dir,
          gitTimeout,
          authEnv,
        );
        await this.exec(
          job.id,
          [ 'git', 'push', authUrl, `refs/tags/${tag}` ],
          dir,
          gitTimeout,
          authEnv,
        );
      } catch (err) {
        throw new Error(
          `自动创建并推送 tag ${tag} 失败。请确认 PAT 有 Contents: Write（或 classic repo）权限。${err.message}`,
        );
      }
      await this.append(job.id, 'info', `[github] 已推送 tag ${tag} → ${branchSha.slice(0, 12)}`);
    }

    const sha = await this.execCapture(job.id, [ 'git', 'rev-parse', 'HEAD' ], dir, authEnv);
    await this.append(job.id, 'info', `[fetch] checkout ${tag} sha=${sha.slice(0, 12)}`);
    return sha.slice(0, 40);
  }

  async cloneByRef(jobId, authUrl, ref, dir, timeoutMs, authEnv, publicUrl) {
    try {
      await this.exec(
        jobId,
        [ 'git', 'clone', '--depth', '1', '--branch', ref, authUrl, dir ],
        path.dirname(dir),
        timeoutMs,
        authEnv,
      );
      // 去掉 .git/config 里的带 token 远程地址，后续 push 显式传 authUrl
      await this.exec(
        jobId,
        [ 'git', 'remote', 'set-url', 'origin', publicUrl ],
        dir,
        timeoutMs,
        authEnv,
      );
    } catch (err) {
      throw new Error(`GitHub 克隆失败（ref ${ref}，仓库 ${publicUrl}）。${err.message}`);
    }
  }

  async runAgentrun(job, dir) {
    const config = job.params?.deploy_config || {};
    const ar = config.agentrun || {};
    const homeDir = path.join(dir, '.ops-home');
    fs.mkdirSync(homeDir, { recursive: true });
    const prepared = agentrun.materialize(dir, homeDir, ar);
    await this.append(job.id, 'info', `[agentrun] 已写入 deploy/config/.env.${prepared.envName} 与隔离 ~/.s（别名 ${prepared.alias}）`);
    await this.append(job.id, 'info', `[agentrun] RAM 策略 / Workspace / 会话亲和见项目配置前置条件，执行 ${prepared.argv.join(' ')}`);
    if (!fs.existsSync(path.join(dir, 'deploy', 'scripts', 'run.mjs'))) {
      throw new Error('仓库里没有 deploy/scripts/run.mjs。GitHub 请把 tag 打在 fitness-agent 仓库根的提交上；本地 source_path 请指向 fitness-agent 而不是只含 .pi 的目录。');
    }
    const timeout = Number(process.env.OPS_DEPLOY_AGENTRUN_TIMEOUT_MS || 30 * 60 * 1000);
    const extraEnv = {
      HOME: homeDir,
      USERPROFILE: homeDir,
      ...prepared.map,
    };
    await this.exec(job.id, prepared.argv, dir, timeout, extraEnv);
    await this.append(job.id, 'info', '[check] AgentRun 命令退出码 0；请到控制台确认会话亲和已关闭');
  }

  projectType(job) {
    return job.project_type || job.project?.project_type || '';
  }

  resolveCommand(job) {
    const type = this.projectType(job);
    const params = job.params || {};
    if (type === 'backend') return params.install_cmd || 'npm ci';
    if (type === 'agent') return params.build_cmd || params.install_cmd || 'node -e "console.log(1)"';
    if (type === 'frontend' || type === 'fullstack') {
      return params.build_cmd || 'npm ci && npm run build';
    }
    return params.build_cmd || params.install_cmd || 'node -e "console.log(1)"';
  }

  parseBuild(job) {
    try {
      return splitAndParse(this.resolveCommand(job));
    } catch (err) {
      throw new Error(`非法构建命令：${err.message}`);
    }
  }

  async build(job, dir) {
    const command = this.resolveCommand(job);
    await this.append(job.id, 'info', `[build] ${command}`);
    const steps = this.parseBuild(job);
    const timeout = Number(process.env.OPS_DEPLOY_BUILD_TIMEOUT_MS || 15 * 60 * 1000);
    for (const argv of steps) {
      if (!(await this.stillRunning(job.id))) return;
      await this.exec(job.id, argv, dir, timeout);
    }
  }

  async check(job, dir) {
    const type = this.projectType(job);
    const outDir = (job.params || {}).out_dir || 'dist';
    if (type === 'frontend' || type === 'fullstack') {
      const target = path.join(dir, outDir);
      if (!fs.existsSync(target)) throw new Error(`检查失败：产物目录不存在 ${outDir}`);
      await this.append(job.id, 'info', `[check] 产物目录 ${outDir} 存在`);
      return;
    }
    await this.append(job.id, 'info', '[check] 退出码 0');
  }

  exec(jobId, argv, cwd, timeoutMs, extraEnv) {
    return new Promise((resolve, reject) => {
      const child = spawn(argv[0], argv.slice(1), {
        cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...(extraEnv || {}) },
        windowsHide: true,
      });
      track(jobId, child);
      let stderrTail = '';
      const onOut = (buf, level) => {
        String(buf).split(/\r?\n/).forEach(line => {
          const text = line.trim();
          if (!text) return;
          if (level === 'warn' || level === 'error') stderrTail = (stderrTail + '\n' + text).slice(-800);
          this.append(jobId, level, text).catch(() => {});
        });
      };
      child.stdout.on('data', buf => onOut(buf, 'info'));
      child.stderr.on('data', buf => onOut(buf, 'warn'));
      const timer = timeoutMs ? setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`命令超时：${argv[0]}`));
      }, timeoutMs) : null;
      child.on('error', err => {
        if (timer) clearTimeout(timer);
        untrack(jobId);
        if (argv[0] === 'git' && err.code === 'ENOENT') {
          reject(new Error('容器内没有 git，无法克隆 GitHub 仓库'));
          return;
        }
        reject(new Error(`无法启动 ${argv[0]}：${err.message}`));
      });
      child.on('close', code => {
        if (timer) clearTimeout(timer);
        untrack(jobId);
        if (code === 0) resolve();
        else reject(new Error(redactDeployLog(stderrTail.trim() || `命令失败 exit ${code}`)));
      });
    });
  }

  execCapture(jobId, argv, cwd, extraEnv) {
    return new Promise((resolve, reject) => {
      const child = spawn(argv[0], argv.slice(1), {
        cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...(extraEnv || {}) },
        windowsHide: true,
      });
      track(jobId, child);
      let out = '';
      child.stdout.on('data', buf => { out += buf; });
      child.stderr.on('data', buf => { out += buf; });
      child.on('close', code => {
        untrack(jobId);
        if (code === 0) resolve(String(out).trim());
        else reject(new Error(redactDeployLog(out.trim() || `命令失败 exit ${code}`)));
      });
      child.on('error', err => {
        untrack(jobId);
        if (argv[0] === 'git' && err.code === 'ENOENT') {
          reject(new Error('容器内没有 git，无法访问 GitHub'));
          return;
        }
        reject(err);
      });
    });
  }

  pruneWorkspaces() {
    const root = this.workRoot();
    if (!fs.existsSync(root)) return;
    const dirs = fs.readdirSync(root)
      .map(name => ({ name, full: path.join(root, name), mtime: fs.statSync(path.join(root, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    dirs.slice(KEEP).forEach(item => {
      fs.rmSync(item.full, { recursive: true, force: true });
    });
  }
}

module.exports = DeployRunnerService;
