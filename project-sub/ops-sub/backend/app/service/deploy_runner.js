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
const { publicCloneUrl, cloneUrlWithToken, gitAuthEnv, withGitHttpCompat, classifyGithubGitError, resolveCodeSource, parseLsRemoteRefSha, sameGitSha, assertGitTagName, normalizePackagePath, parseGithubHttps } = require('../lib/gitSource');
const { runOssPreflight, agentrunNetworkEnv } = require('../lib/deployOssPreflight');
const { resolveDeployExecutor } = require('../lib/deployNetwork');
const { execOnHost } = require('../lib/hostDeployClient');
const { downloadGithubPathPackage, downloadGithubFile, resolveGithubZipFilePath, createLightweightTag } = require('../lib/githubPathPackage');

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
      if (isAgentrun(product)) {
        await this.persistAgentrunBinding(job);
      }
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
      const packagePath = this.resolveAgentrunPackagePath(job);
      if (packagePath) {
        const zip = agentrun.resolveLocalArtifactZip(job.project, packagePath);
        if (!zip) {
          throw new Error(
            `本地预打 zip 未找到：${packagePath}（相对 source_path；可填 backup/ss.zip，或含 artifact.zip 的目录）`,
          );
        }
        const dest = agentrun.placeArtifactZip(dir, zip);
        const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
        await this.append(job.id, 'info', `[source] 已放置预打 zip ${zip} → artifact.zip（≈ ${mb} MB），将跳过 pack`);
      }
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

  resolveAgentrunPackagePath(job) {
    try {
      return normalizePackagePath(
        job.params?.deploy_config?.agentrun?.package_path
        || job.params?.agentrun?.package_path,
      );
    } catch (err) {
      err.message = err.message || '包路径无效';
      throw err;
    }
  }

  /** GitHub：预打 zip 只下载一次；zip 在 deploy/ 下则随脚手架一次拉齐，否则脚手架排除 zip 再单拉目标包 */
  async prepareGithubPrebuiltZip(job, dir, remote, tag, packagePath, token) {
    const zipRel = await resolveGithubZipFilePath({
      repoUrl: remote,
      ref: tag,
      packagePath,
      token,
    });
    const zipUnderDeploy = zipRel === 'deploy' || zipRel.startsWith('deploy/');
    const deployDir = path.join(dir, 'deploy');
    const dest = agentrun.artifactZipTarget(dir);

    if (zipUnderDeploy) {
      await this.append(
        job.id,
        'info',
        `[github] 预打 zip 位于 ${zipRel}，随 deploy/ 一次拉取（不二次下载）`,
      );
      const scaffold = await downloadGithubPathPackage({
        repoUrl: remote,
        ref: tag,
        packagePath: 'deploy',
        token,
        destDir: deployDir,
        onProgress: (msg) => this.append(job.id, 'info', `[github] ${msg}`),
      });
      const sourced = path.join(dir, ...zipRel.split('/'));
      if (!fs.existsSync(sourced)) {
        throw new Error(`已拉取 deploy/，但未找到预打 zip：${zipRel}`);
      }
      if (path.resolve(sourced) !== path.resolve(dest)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(sourced, dest);
      }
      const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
      const head = Buffer.alloc(2);
      const fd = fs.openSync(dest, 'r');
      try {
        fs.readSync(fd, head, 0, 2, 0);
      } finally {
        fs.closeSync(fd);
      }
      if (head[0] !== 0x50 || head[1] !== 0x4b) {
        throw new Error(`预打文件不是 zip：${zipRel}`);
      }
      await this.append(
        job.id,
        'info',
        `[fetch] 一次拉取 ${scaffold.fileCount} 个文件，artifact.zip ≈ ${mb} MB；sha=${scaffold.sha.slice(0, 12)}；跳过 pack`,
      );
      return scaffold.sha.slice(0, 40);
    }

    await this.append(
      job.id,
      'info',
      `[github] 预打 zip：${zipRel}（不在 deploy/ 内）；脚手架排除 zip，目标包只下一次`,
    );
    const scaffold = await downloadGithubPathPackage({
      repoUrl: remote,
      ref: tag,
      packagePath: 'deploy',
      token,
      destDir: deployDir,
      exclude: (repoPath) => /\.zip$/i.test(repoPath),
      onProgress: (msg) => this.append(job.id, 'info', `[github] ${msg}`),
    });
    const zipMeta = await downloadGithubFile({
      repoUrl: remote,
      ref: tag,
      filePath: zipRel,
      token,
      destFile: dest,
      onProgress: (msg) => this.append(job.id, 'info', `[github] ${msg}`),
    });
    const mb = (zipMeta.bytes / (1024 * 1024)).toFixed(1);
    await this.append(
      job.id,
      'info',
      `[fetch] 脚手架 ${scaffold.fileCount} 文件 + zip 一次 ≈ ${mb} MB；sha=${zipMeta.sha.slice(0, 12)}；跳过 pack`,
    );
    return zipMeta.sha.slice(0, 40);
  }

  async prepareGithubRepo(job, dir, remote, rawTag) {
    if (!/^https?:\/\/github\.com\//i.test(remote)) {
      throw new Error('GitHub 部署需要 HTTPS 仓库地址');
    }
    const tag = assertGitTagName(rawTag);
    const branch = job.params?.git_branch || job.params?.deploy_config?.git_branch || 'main';
    const packagePath = this.resolveAgentrunPackagePath(job);
    const token = await this.resolveGithubToken(job);
    const publicUrl = publicCloneUrl(remote);
    const authUrl = cloneUrlWithToken(remote, token);
    const gitTimeout = Number(process.env.OPS_DEPLOY_GIT_TIMEOUT_MS || 5 * 60 * 1000);
    const authEnv = gitAuthEnv();

    await this.append(job.id, 'info', `[github] 仓库 ${publicUrl}，分支 ${branch}，发布 tag ${tag}`);
    if (packagePath) {
      await this.append(job.id, 'info', `[github] 包路径 ${packagePath}：使用预打 zip，不克隆全仓、不在此机 pack`);
    }
    await this.append(job.id, 'info', `[github] 已读取部署人 PAT（长度 ${token.length}，前缀 ${token.slice(0, 4)}…），「保存配置」不会改动 Token`);

    let branchSha = '';
    let tagSha = '';
    try {
      const branchOut = await this.gitRemote(
        job.id,
        [ 'git', 'ls-remote', authUrl, `refs/heads/${branch}` ],
        path.dirname(dir),
        authEnv,
        { capture: true },
      );
      branchSha = parseLsRemoteRefSha(branchOut, `refs/heads/${branch}`);
      const tagOut = await this.gitRemote(
        job.id,
        [ 'git', 'ls-remote', '--tags', authUrl, `refs/tags/${tag}` ],
        path.dirname(dir),
        authEnv,
        { capture: true },
      );
      tagSha = parseLsRemoteRefSha(tagOut, `refs/tags/${tag}`);
    } catch (err) {
      throw new Error(classifyGithubGitError(err));
    }
    if (!branchSha) {
      throw new Error(`远程不存在分支 ${branch}，请先把代码推到该分支`);
    }

    if (tagSha && sameGitSha(tagSha, branchSha)) {
      await this.append(job.id, 'info', `[github] tag ${tag} 已指向 ${branch} HEAD，直接拉取`);
    } else if (tagSha && !sameGitSha(tagSha, branchSha)) {
      throw new Error(
        `远程已有 tag ${tag}，但指向的提交与 ${branch} HEAD 不同。请换一个新 tag 名再部署，避免覆盖已有发布点。`,
      );
    } else if (packagePath) {
      await this.append(job.id, 'info', `[github] 远程尚无 tag ${tag}，将通过 API 在 ${branch} HEAD 创建轻量 tag`);
      const parsed = parseGithubHttps(remote);
      try {
        await createLightweightTag({
          owner: parsed.owner,
          repo: parsed.repo,
          tag,
          sha: branchSha,
          token,
        });
      } catch (err) {
        throw new Error(
          `自动创建 tag ${tag} 失败。请确认 PAT 有 Contents: Write（或 classic repo）权限。${err.message}`,
        );
      }
      await this.append(job.id, 'info', `[github] 已创建 tag ${tag} → ${branchSha.slice(0, 12)}`);
    } else {
      await this.append(job.id, 'info', `[github] 远程尚无 tag ${tag}，将在 ${branch} HEAD 创建并推送`);
      await this.cloneByRef(job.id, authUrl, branch, dir, gitTimeout, authEnv, publicUrl);
      try {
        await this.exec(
          job.id,
          withGitHttpCompat([ 'git', '-c', 'user.name=ops-sub', '-c', 'user.email=ops-sub@local', 'tag', '-a', tag, '-m', `ops-sub deploy #${job.id}` ]),
          dir,
          gitTimeout,
          authEnv,
        );
        await this.gitRemote(
          job.id,
          [ 'git', 'push', authUrl, `refs/tags/${tag}` ],
          dir,
          authEnv,
          { timeoutMs: gitTimeout },
        );
      } catch (err) {
        throw new Error(
          `自动创建并推送 tag ${tag} 失败。请确认 PAT 有 Contents: Write（或 classic repo）权限。${err.message}`,
        );
      }
      await this.append(job.id, 'info', `[github] 已推送 tag ${tag} → ${branchSha.slice(0, 12)}`);
      const sha = await this.execCapture(job.id, [ 'git', 'rev-parse', 'HEAD' ], dir, authEnv);
      await this.append(job.id, 'info', `[fetch] checkout ${tag} sha=${sha.slice(0, 12)}`);
      return sha.slice(0, 40);
    }

    if (packagePath) {
      try {
        return await this.prepareGithubPrebuiltZip(job, dir, remote, tag, packagePath, token);
      } catch (err) {
        throw new Error(`预打 zip 拉取失败（${packagePath}）。${err.message}`);
      }
    }

    if (!(tagSha && sameGitSha(tagSha, branchSha))) {
      throw new Error('内部状态错误：全量克隆分支流程未返回');
    }
    await this.cloneByRef(job.id, authUrl, tag, dir, gitTimeout, authEnv, publicUrl);
    const sha = await this.execCapture(job.id, [ 'git', 'rev-parse', 'HEAD' ], dir, authEnv);
    await this.append(job.id, 'info', `[fetch] checkout ${tag} sha=${sha.slice(0, 12)}`);
    return sha.slice(0, 40);
  }

  async gitRemote(jobId, argv, cwd, authEnv, { timeoutMs, capture = false, attempts = 3 } = {}) {
    let lastErr;
    for (let i = 1; i <= attempts; i++) {
      try {
        const cmd = withGitHttpCompat(argv);
        if (capture) return await this.execCapture(jobId, cmd, cwd, authEnv);
        await this.exec(jobId, cmd, cwd, timeoutMs, authEnv);
        return '';
      } catch (err) {
        lastErr = err;
        const msg = String(err.message || '');
        const retryable = /TLS|SSL|unexpected eof|unable to access|Failed to connect|Connection reset/i.test(msg);
        if (!retryable || i === attempts) break;
        await this.append(jobId, 'warn', `[github] 网络抖动，第 ${i}/${attempts} 次重试…`);
        await new Promise(resolve => setTimeout(resolve, 800 * i));
      }
    }
    throw lastErr;
  }

  async cloneByRef(jobId, authUrl, ref, dir, timeoutMs, authEnv, publicUrl) {
    try {
      await this.gitRemote(
        jobId,
        [ 'git', 'clone', '--depth', '1', '--branch', ref, authUrl, dir ],
        path.dirname(dir),
        authEnv,
        { timeoutMs },
      );
      // 去掉 .git/config 里的带 token 远程地址，后续 push 显式传 authUrl
      await this.exec(
        jobId,
        withGitHttpCompat([ 'git', 'remote', 'set-url', 'origin', publicUrl ]),
        dir,
        timeoutMs,
        authEnv,
      );
    } catch (err) {
      throw new Error(`GitHub 克隆失败（ref ${ref}，仓库 ${publicUrl}）。${classifyGithubGitError(err)}`);
    }
  }

  async runAgentrun(job, dir) {
    const config = job.params?.deploy_config || {};
    const ar = config.agentrun || {};
    const packagePath = this.resolveAgentrunPackagePath(job);
    const homeDir = path.join(dir, '.ops-home');
    fs.mkdirSync(homeDir, { recursive: true });
    const prepared = agentrun.materialize(dir, homeDir, ar);
    await this.append(job.id, 'info', `[agentrun] 已写入 deploy/config/.env.${prepared.envName} 与隔离 ~/.s（别名 ${prepared.alias}）`);
    if (prepared.componentSeed?.seeded) {
      await this.append(job.id, 'info', `[agentrun] 已复用本地 agentrun 组件缓存（跳过易失败的 registry latest 探测）`);
    }

    const artifactZip = agentrun.artifactZipTarget(dir);
    const usePrebuiltZip = Boolean(packagePath) && fs.existsSync(artifactZip);
    const deploySh = path.join(dir, 'deploy', 'agentrun', 'code-package', 'scripts', 'deploy.sh');
    if (usePrebuiltZip) {
      if (!fs.existsSync(deploySh)) {
        throw new Error('预打 zip 部署需要 deploy/agentrun/code-package/scripts/deploy.sh（GitHub 应能拉到 deploy/ 脚手架）');
      }
      const mb = (fs.statSync(artifactZip).size / (1024 * 1024)).toFixed(1);
      await this.append(
        job.id,
        'info',
        `[agentrun] 使用预打 artifact.zip ≈ ${mb} MB（包路径 ${packagePath}），跳过 pack，直接 s deploy 上传阿里云`,
      );
    } else if (!fs.existsSync(path.join(dir, 'deploy', 'scripts', 'run.mjs'))) {
      throw new Error('仓库里没有 deploy/scripts/run.mjs。GitHub 请把 tag 打在 fitness-agent 仓库根的提交上；本地 source_path 请指向 fitness-agent 而不是只含 .pi 的目录。');
    } else if (fs.existsSync(artifactZip)) {
      const mb = (fs.statSync(artifactZip).size / (1024 * 1024)).toFixed(1);
      await this.append(
        job.id,
        'info',
        `[agentrun] artifact.zip ≈ ${mb} MB；未配置包路径时仍会走 fitness-cli（含 pack）`,
      );
    }

    await this.append(job.id, 'info', '[agentrun] 探测部署执行面（容器直连 vs 宿主机，与 fitness-cli 对齐）…');
    const execPlan = await resolveDeployExecutor({
      ...process.env,
      OPS_FC_PROBE_ACCOUNT: String(ar.account?.account_id || process.env.OPS_FC_PROBE_ACCOUNT || ''),
    });
    await this.append(job.id, 'info', `[agentrun] 执行面=${execPlan.mode}；${execPlan.reason}`);
    if (execPlan.error) {
      throw new Error(execPlan.error);
    }

    if (execPlan.mode === 'direct') {
      await this.append(job.id, 'info', '[oss-preflight] 容器直连模式：检查加速上传…');
      const preflight = await runOssPreflight({
        ...process.env,
        OPS_FC_PROBE_ACCOUNT: String(ar.account?.account_id || ''),
        OPS_HOST_EGRESS_DISABLED: '1',
      });
      for (const line of preflight.lines) {
        await this.append(job.id, preflight.ok ? 'info' : 'warn', line);
      }
      if (!preflight.ok) {
        throw new Error(preflight.error || 'OSS 出网预检失败');
      }
    }

    const timeout = Number(process.env.OPS_DEPLOY_AGENTRUN_TIMEOUT_MS || 45 * 60 * 1000);
    await this.append(job.id, 'info', `[agentrun] 整段命令超时上限 ${Math.round(timeout / 60000)} 分钟`);
    const netEnv = agentrunNetworkEnv({
      ...process.env,
      OPS_HOST_EGRESS_DISABLED: execPlan.mode === 'host' ? '1' : process.env.OPS_HOST_EGRESS_DISABLED,
      // host 模式禁止注入 egress agent；direct 且 ECS 也应默认禁用
      OPS_HOST_EGRESS_ENABLED: process.env.OPS_HOST_EGRESS_ENABLED || '0',
    });
    const extraEnv = {
      HOME: homeDir,
      USERPROFILE: homeDir,
      CI: '1',
      FORCE_COLOR: '0',
      TERM: 'dumb',
      ...prepared.map,
      ...netEnv,
    };
    if (ar.account?.account_id) {
      extraEnv.OPS_FC_PROBE_ACCOUNT = String(ar.account.account_id);
    }
    // Node22 UpdateAgentRuntime 补丁：直接注入 AK，避免依赖加密版 ~/.s
    if (ar.account?.access_key_id) {
      extraEnv.ALIBABA_CLOUD_ACCESS_KEY_ID = String(ar.account.access_key_id);
      extraEnv.ACCESS_KEY_ID = String(ar.account.access_key_id);
    }
    if (ar.account?.access_key_secret) {
      extraEnv.ALIBABA_CLOUD_ACCESS_KEY_SECRET = String(ar.account.access_key_secret);
      extraEnv.ACCESS_KEY_SECRET = String(ar.account.access_key_secret);
    }

    const argv = usePrebuiltZip
      ? agentrun.resolveDeployOnlyArgv(prepared.envName)
      : prepared.argv;

    if (execPlan.mode === 'host') {
      if (!String(process.env.OPS_DEPLOY_WORKDIR_HOST || '').trim()) {
        throw new Error(
          '宿主机执行器需要 OPS_DEPLOY_WORKDIR_HOST（与容器 OPS_DEPLOY_WORKDIR 绑定同一目录）。' +
          '请检查 deploy/config/.env.local 后 ams-ops local 重启',
        );
      }
      await this.append(
        job.id,
        'info',
        `[agentrun] 经宿主机执行器运行（等同 fitness-cli 网络）：${argv.join(' ')}`,
      );
      await execOnHost({
        cwd: dir,
        argv,
        env: extraEnv,
        timeoutMs: timeout,
        onLog: (text, level) => {
          this.append(job.id, level || 'info', text).catch(() => {});
        },
      });
    } else {
      await this.append(job.id, 'info', `[agentrun] 容器内直连执行：${argv.join(' ')}`);
      await this.exec(job.id, argv, dir, timeout, extraEnv);
    }
    await this.append(job.id, 'info', '[check] AgentRun 命令退出码 0；请到控制台确认会话亲和已关闭');
  }

  async persistAgentrunBinding(job) {
    try {
      const { syncBindingAfterDeploy } = require('../lib/agentrunRuntimeOps');
      const project = job.project
        || await this.ctx.service.project.findById(job.project_id);
      const nextConfig = await syncBindingAfterDeploy(project, job.params?.deploy_config?.agentrun);
      if (!nextConfig) {
        await this.append(job.id, 'warn', '[binding] 未能同步线上 runtime id（详情页可稍后刷新状态）');
        return;
      }
      await this.ctx.model.OpsProject.update(
        { deploy_config: nextConfig },
        { where: { id: project.id } },
      );
      const id = nextConfig.agentrun?.binding?.agent_runtime_id || '';
      await this.append(
        job.id,
        'info',
        `[binding] 已写入 runtime 绑定${id ? `：${id}` : ''}`,
      );
    } catch (err) {
      await this.append(job.id, 'warn', `[binding] 同步失败：${err.message}`);
    }
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
      const startedAt = Date.now();
      const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', ...(extraEnv || {}) };
      // 空字符串仍会被 axios 当成「已配置代理」；必须 delete
      for (const key of [
        'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY',
        'http_proxy', 'https_proxy', 'all_proxy',
        'NO_PROXY', 'no_proxy',
      ]) {
        if (env[key] == null || String(env[key]).trim() === '') delete env[key];
      }
      const child = spawn(argv[0], argv.slice(1), {
        cwd,
        env,
        windowsHide: true,
      });
      track(jobId, child);
      let stderrTail = '';
      let lastLine = '';
      let lastActivity = Date.now();
      const flushChunk = (buf, level) => {
        // s CLI / npm 进度常用 \r 刷新同一行，按 \r|\n 切开才能进黑窗口
        String(buf).split(/\r?\n|\r/).forEach(line => {
          const text = line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim();
          if (!text) return;
          lastActivity = Date.now();
          lastLine = text.slice(0, 200);
          if (level === 'warn' || level === 'error') stderrTail = (stderrTail + '\n' + text).slice(-1200);
          this.append(jobId, level, text).catch(() => {});
        });
      };
      child.stdout.on('data', buf => flushChunk(buf, 'info'));
      child.stderr.on('data', buf => flushChunk(buf, 'warn'));

      const heartbeatMs = Number(process.env.OPS_DEPLOY_HEARTBEAT_MS || 20 * 1000);
      const heartbeat = setInterval(() => {
        const silentSec = Math.round((Date.now() - lastActivity) / 1000);
        if (silentSec < Math.round(heartbeatMs / 1000)) return;
        const ranSec = Math.round((Date.now() - startedAt) / 1000);
        const tip = lastLine ? `；最近输出：${lastLine}` : '';
        this.append(
          jobId,
          'info',
          `[heartbeat] 命令仍在运行（已 ${ranSec}s，距上次输出 ${silentSec}s）${tip}`,
        ).catch(() => {});
      }, heartbeatMs);

      const timer = timeoutMs ? setTimeout(() => {
        child.kill('SIGKILL');
        const ranMin = ((Date.now() - startedAt) / 60000).toFixed(1);
        reject(new Error(
          `命令超时（${ranMin} 分钟）：${argv[0]}。` +
          '若卡在 Uploading code to temporary OSS：本地一键通常不会这么久，请查 Docker Desktop 代理/VPN/公司网拦截，或看任务日志里的 [oss-preflight]。' +
          `最近输出：${lastLine || '(无)'}`,
        ));
      }, timeoutMs) : null;

      child.on('error', err => {
        clearInterval(heartbeat);
        if (timer) clearTimeout(timer);
        untrack(jobId);
        if (argv[0] === 'git' && err.code === 'ENOENT') {
          reject(new Error('容器内没有 git，无法克隆 GitHub 仓库'));
          return;
        }
        reject(new Error(`无法启动 ${argv[0]}：${err.message}`));
      });
      child.on('close', code => {
        clearInterval(heartbeat);
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
