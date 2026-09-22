'use strict';

const { Service } = require('egg');
const { Op } = require('sequelize');
const { redactDeployLog } = require('../lib/deployLogRedact');
const { emitJobEvent } = require('../lib/deployEvents');
const {
  normalizeDeployConfig,
  isAgentrun,
  isDemoProduct,
  assertAgentrunReady,
} = require('../lib/deployProducts');
const { resolveAgentrunSource } = require('../lib/deployAgentrun');
const menuMaster = require('../lib/menuMaster');
const { parseGithubRepo, resolveCodeSource, resolveGitBranch, resolveGitProtocol, formatGithubCloneUrl, assertGitTagName, suggestNextReleaseTag } = require('../lib/gitSource');

const ACTIVE = [ 'queued', 'running' ];
const TERMINAL = [ 'success', 'failed', 'aborted' ];

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function defaultParams(projectType) {
  const common = { env: 'staging', notify_email: '' };
  if (projectType === 'backend') {
    return { ...common, install_cmd: 'npm ci', start_hint: 'npm run start' };
  }
  if (projectType === 'agent') {
    return { ...common, skill_name: '' };
  }
  return { ...common, build_cmd: 'npm ci && npm run build', out_dir: 'dist' };
}

function parseRepo(repoUrl) {
  const raw = String(repoUrl || '').trim();
  const github = parseGithubRepo(raw);
  if (github) {
    return {
      host: 'github.com',
      owner: github.owner,
      repo: github.repo,
      protocol: github.protocol,
    };
  }
  const https = raw.match(/^https?:\/\/(gitee\.com)\/([^/]+)\/([^/#?]+)/i);
  if (!https) return null;
  return {
    host: https[1].toLowerCase(),
    owner: https[2],
    repo: https[3].replace(/\.git$/i, ''),
    protocol: 'https',
  };
}

class DeployService extends Service {
  actorName() {
    const user = this.ctx.state.user || {};
    const name = String(user.username || '').trim();
    if (!name) throw fail('未登录', 401);
    return name;
  }

  async requireProject(id) {
    return this.ctx.service.project.findById(id);
  }

  toPublicJob(row, project) {
    const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    if (project) {
      json.project_name = project.name;
      json.project_type = project.project_type;
    } else if (row.project) {
      json.project_name = row.project.name;
      json.project_type = row.project.project_type;
    }
    return json;
  }

  async findActive(projectId) {
    return this.ctx.model.OpsDeployJob.findOne({
      where: { project_id: projectId, status: { [Op.in]: ACTIVE } },
      order: [[ 'id', 'DESC' ]],
    });
  }

  async createJob(projectId, body = {}) {
    const project = await this.requireProject(projectId);
    const deployConfig = normalizeDeployConfig(body.deploy_config || project.deploy_config);
    const product = deployConfig.product;
    if (isAgentrun(product)) assertAgentrunReady(deployConfig);

    const repoUrl = String(body.repo_url || project.repo_url || '').trim();
    const codeSource = resolveCodeSource(body.code_source || deployConfig.code_source, {
      product,
      tag: body.git_tag,
      repoUrl,
    });
    const gitBranch = resolveGitBranch(body.git_branch || deployConfig.git_branch);
    const gitProtocol = resolveGitProtocol(body.git_protocol || deployConfig.git_protocol, repoUrl);
    deployConfig.code_source = codeSource;
    deployConfig.git_branch = gitBranch;
    deployConfig.git_protocol = gitProtocol;

    let gitTag = String(body.git_tag || deployConfig.git_tag || '').trim();
    if (codeSource === 'local') {
      gitTag = 'source';
      if (isAgentrun(product) && !resolveAgentrunSource(project)) {
        throw fail('本地部署需要容器可见的 source_path（宿主机项目须挂到 HOST_PROJECTS_ROOT，路径须能走到含 deploy/scripts/run.mjs 的仓库根）');
      }
    } else {
      const parsed = parseGithubRepo(repoUrl);
      if (!parsed) {
        throw fail('GitHub 部署需要仓库地址：HTTPS（https://github.com/org/repo.git）或 SSH（git@github.com:org/repo.git）');
      }
      // 按所选协议规范化落库地址
      const effectiveRepoUrl = formatGithubCloneUrl(parsed, gitProtocol) || repoUrl;
      if (!gitTag || gitTag === 'source' || gitTag === 'demo') {
        throw fail('请填写本次发布 tag（例如 v0.0.2）。若远程没有该 tag，部署时会在部署分支 HEAD 自动创建并推送');
      }
      try {
        gitTag = assertGitTagName(gitTag);
      } catch (err) {
        throw fail(err.message);
      }
      const incomingToken = String(body.github_token || '').trim();
      if (incomingToken) {
        await menuMaster.saveGithubToken(this.ctx, {
          token: incomingToken,
          github_login: body.github_login,
        });
      }
      let credential = null;
      try {
        credential = await menuMaster.readGithubToken(this.ctx);
      } catch (err) {
        if (err.status !== 404) {
          throw fail(`无法读取个人信息中的 GitHub Token：${err.message}`, err.status || 502);
        }
      }
      if (!credential || !credential.token) {
        const err = fail(
          gitProtocol === 'ssh'
            ? '未配置 GitHub Token。SSH 用于 clone/fetch；自动打 tag、列标签与非镜像下包仍需 PAT，请在弹窗中填写并保存到个人信息'
            : '未配置 GitHub Token，请在弹窗中填写并保存到个人信息',
        );
        err.code = 'GITHUB_TOKEN_REQUIRED';
        throw err;
      }
      try {
        const viaRunner = await menuMaster.readGithubTokenByUsername(this.actorName());
        if (!viaRunner || !viaRunner.token) {
          throw fail('已保存 Token，但部署执行器无法按用户名读取。请确认 MENU_MASTER_URL 与 OPS_INTERNAL_KEY 与主应用一致。');
        }
      } catch (err) {
        if (String(err.message || '').includes('部署执行器无法按用户名读取')) throw err;
        throw fail(`部署执行器读取 GitHub Token 失败：${err.message}。请确认 MENU_MASTER_URL 与 OPS_INTERNAL_KEY 与主应用一致。`, err.status || 502);
      }
      // 用规范化后的地址继续后续流程
      if (effectiveRepoUrl !== repoUrl) {
        body.repo_url = effectiveRepoUrl;
      }
    }
    const finalRepoUrl = String(body.repo_url || repoUrl || project.repo_url || '').trim();
    if (!gitTag && isDemoProduct(product)) gitTag = 'demo';
    if (!gitTag) throw fail('请填写 git tag');
    if (gitTag.length > 128) throw fail('tag 过长');
    deployConfig.git_tag = codeSource === 'github' ? gitTag : (deployConfig.git_tag || '');

    if (finalRepoUrl && finalRepoUrl !== project.repo_url) {
      await this.ctx.model.OpsProject.update({ repo_url: finalRepoUrl }, { where: { id: project.id } });
      project.repo_url = finalRepoUrl;
    }

    const params = {
      ...defaultParams(project.project_type),
      ...(body.params && typeof body.params === 'object' ? body.params : {}),
      product,
      deploy_config: deployConfig,
      code_source: codeSource,
      git_branch: gitBranch,
      git_protocol: gitProtocol,
    };
    delete params.github_token;
    await this.ctx.model.OpsProject.update(
      { deploy_config: deployConfig },
      { where: { id: project.id } },
    );

    const payload = {
      project_id: project.id,
      status: 'queued',
      git_remote: finalRepoUrl || project.repo_url || '',
      git_tag: gitTag,
      params,
      triggered_by: this.actorName(),
      parent_job_id: body.parent_job_id || null,
      retry_count: Number(body.retry_count || 0),
    };

    let row;
    try {
      row = await this.ctx.model.transaction(async transaction => {
        await this.ctx.model.OpsProject.findByPk(project.id, { transaction, lock: transaction.LOCK.UPDATE });
        const active = await this.ctx.model.OpsDeployJob.findOne({
          where: { project_id: project.id, status: { [Op.in]: ACTIVE } },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (active) throw fail(`项目已有进行中的部署 #${active.id}`, 409);
        return this.ctx.model.OpsDeployJob.create(payload, { transaction });
      });
    } catch (err) {
      if (err.status) throw err;
      if (err.name === 'SequelizeUniqueConstraintError' || err.parent?.code === '23505') {
        throw fail('项目已有进行中的部署', 409);
      }
      throw err;
    }

    const job = this.toPublicJob(row, project);
    this.ctx.service.deployDispatch.kick(job.id);
    return job;
  }

  jobInclude() {
    return [{
      model: this.ctx.model.OpsProject,
      as: 'project',
      attributes: [ 'id', 'name', 'project_type', 'repo_url', 'source_path', 'extra_json', 'deploy_config' ],
    }];
  }

  async loadJobRow(jobId) {
    return this.ctx.model.OpsDeployJob.findByPk(jobId, { include: this.jobInclude() });
  }

  async claimRunning(jobId) {
    const row = await this.ctx.model.OpsDeployJob.findByPk(jobId);
    if (!row || row.status !== 'queued') return null;
    const running = await this.ctx.model.OpsDeployJob.findOne({
      where: { project_id: row.project_id, status: 'running' },
    });
    if (running) return null;
    return this.patchStatus(jobId, { status: 'running', started_at: new Date() });
  }

  async getJob(jobId, projectId) {
    const row = await this.loadJobRow(jobId);
    if (!row) throw fail('部署任务不存在', 404);
    if (projectId && Number(row.project_id) !== Number(projectId)) {
      throw fail('任务不属于该项目', 404);
    }
    return this.toPublicJob(row);
  }

  buildJobWhere(query = {}, projectId) {
    const where = {};
    if (projectId) where.project_id = Number(projectId);
    else if (query.project_id) where.project_id = Number(query.project_id);

    if (query.status) {
      const statuses = String(query.status).split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) where.status = statuses[0];
      else if (statuses.length > 1) where.status = { [Op.in]: statuses };
    }
    if (query.triggered_by) {
      where.triggered_by = { [Op.iLike]: `%${String(query.triggered_by).trim()}%` };
    }
    if (query.git_tag) {
      where.git_tag = { [Op.iLike]: `%${String(query.git_tag).trim()}%` };
    }
    if (query.q) {
      const q = `%${String(query.q).trim()}%`;
      where[Op.or] = [
        { git_tag: { [Op.iLike]: q } },
        { error_summary: { [Op.iLike]: q } },
        { triggered_by: { [Op.iLike]: q } },
      ];
    }
    if (query.from || query.to) {
      where.created_at = {};
      if (query.from) where.created_at[Op.gte] = new Date(query.from);
      if (query.to) where.created_at[Op.lte] = new Date(query.to);
    }
    return where;
  }

  async summarize() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const Job = this.ctx.model.OpsDeployJob;
    const [ running, success_today, failed_today ] = await Promise.all([
      Job.count({ where: { status: { [Op.in]: ACTIVE } } }),
      Job.count({ where: { status: 'success', finished_at: { [Op.gte]: start } } }),
      Job.count({ where: { status: 'failed', finished_at: { [Op.gte]: start } } }),
    ]);
    return { running, success_today, failed_today };
  }

  async listJobs(query = {}, projectId) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where = this.buildJobWhere(query, projectId);
    const { rows, count } = await this.ctx.model.OpsDeployJob.findAndCountAll({
      where,
      include: this.jobInclude(),
      order: [[ 'created_at', 'DESC' ]],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });
    return {
      list: rows.map(row => this.toPublicJob(row)),
      total: count,
      page,
      pageSize,
    };
  }

  async appendLog(jobId, { level = 'info', message }) {
    const line = await this.ctx.model.OpsDeployLogLine.create({
      job_id: Number(jobId),
      level: [ 'debug', 'info', 'warn', 'error' ].includes(level) ? level : 'info',
      message: redactDeployLog(message),
    });
    const json = line.toJSON();
    emitJobEvent(jobId, 'log', json);
    return json;
  }

  async listLogs(jobId, query = {}, projectId) {
    await this.getJob(jobId, projectId);
    const where = { job_id: Number(jobId) };
    if (query.after) where.id = { [Op.gt]: Number(query.after) };
    if (query.level) {
      const levels = String(query.level).split(',').map(s => s.trim()).filter(Boolean);
      if (levels.length) where.level = { [Op.in]: levels };
    }
    if (query.q) where.message = { [Op.iLike]: `%${String(query.q).trim()}%` };
    const rows = await this.ctx.model.OpsDeployLogLine.findAll({
      where,
      order: [[ 'id', 'ASC' ]],
      limit: Math.min(5000, Number(query.limit) || 2000),
    });
    return { list: rows.map(row => row.toJSON()) };
  }

  async exportLogsText(jobId, projectId) {
    await this.getJob(jobId, projectId);
    const rows = await this.ctx.model.OpsDeployLogLine.findAll({
      where: { job_id: Number(jobId) },
      order: [[ 'id', 'ASC' ]],
    });
    return rows.map(row => {
      const item = row.toJSON();
      const time = item.created_at ? new Date(item.created_at).toISOString() : '';
      return `${time} [${item.level}] ${item.message}`;
    }).join('\n');
  }

  async patchStatus(jobId, patch) {
    const row = await this.loadJobRow(jobId);
    if (!row) throw fail('部署任务不存在', 404);
    if (TERMINAL.includes(row.status) && patch.status && patch.status !== row.status) {
      throw fail('终态不可再改');
    }
    const next = { ...patch };
    if (next.error_summary) next.error_summary = redactDeployLog(next.error_summary);
    await row.update(next);
    const job = this.toPublicJob(row);
    emitJobEvent(jobId, 'status', job);
    if (TERMINAL.includes(job.status)) emitJobEvent(jobId, 'end', { status: job.status });
    return job;
  }

  async abort(jobId, projectId) {
    const job = await this.getJob(jobId, projectId);
    if (!ACTIVE.includes(job.status)) throw fail('仅进行中的任务可中止');
    this.ctx.service.deployRunner.kill(jobId);
    return this.patchStatus(jobId, {
      status: 'aborted',
      finished_at: new Date(),
      error_summary: '用户中止',
    });
  }

  async retry(jobId, projectId) {
    const job = await this.getJob(jobId, projectId);
    if (job.status !== 'failed') throw fail('仅失败任务可重试');
    return this.createJob(job.project_id, {
      git_tag: job.git_tag,
      params: job.params,
      deploy_config: job.params?.deploy_config,
      code_source: job.params?.code_source,
      git_branch: job.params?.git_branch,
      repo_url: job.git_remote,
      parent_job_id: job.id,
      retry_count: Number(job.retry_count || 0) + 1,
    });
  }

  async listGitTags(projectId, query = {}) {
    const project = await this.requireProject(projectId);
    const repoUrl = String(query.repo_url || project.repo_url || '').trim();
    const parsed = parseRepo(repoUrl);
    if (!parsed) {
      const empty = suggestNextReleaseTag([]);
      return {
        list: [],
        ...empty,
        message: repoUrl ? '仅支持 GitHub（HTTPS/SSH）或 Gitee HTTPS 地址' : '未配置仓库地址，可手动输入 tag',
      };
    }
    try {
      const list = parsed.host === 'gitee.com'
        ? await this.fetchGiteeTags(parsed)
        : await this.fetchGithubTags(parsed);
      const suggested = suggestNextReleaseTag(list);
      return {
        list,
        ...suggested,
        message: list.length
          ? (suggested.latest_tag
            ? `远程最新 ${suggested.latest_tag} → 建议发布 ${suggested.next_tag}`
            : `已拉取 ${list.length} 个标签（无语义化版本），建议发布 ${suggested.next_tag}`)
          : `未读到 tag，建议从 ${suggested.next_tag} 开始`,
      };
    } catch (err) {
      this.ctx.logger.warn('[Deploy] git-tags failed: %s', err.message);
      const empty = suggestNextReleaseTag([]);
      return { list: [], ...empty, message: err.message || '拉取标签失败' };
    }
  }

  async fetchGithubTags({ owner, repo }) {
    let token = '';
    try {
      const cred = await menuMaster.readGithubToken(this.ctx)
        || await menuMaster.readGithubTokenByUsername(this.actorName());
      token = cred?.token || '';
    } catch {
      token = '';
    }
    if (!token) token = process.env.OPS_GIT_TOKEN || '';
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'ops-sub' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`, { headers });
    if (res.status === 401 || res.status === 403) {
      throw new Error('无法列出 tag：仓库私有或 GitHub Token 无效。一键部署时会弹出填写，或到账号设置保存。');
    }
    if (res.status === 404) throw new Error('GitHub 仓库不存在，或当前 Token 无权访问');
    if (!res.ok) throw new Error(`GitHub 返回 ${res.status}`);
    const rows = await res.json();
    return (Array.isArray(rows) ? rows : []).map(item => ({
      name: item.name,
      sha: item.commit?.sha || '',
      published_at: item.commit?.date || null,
    }));
  }

  async fetchGiteeTags({ owner, repo }) {
    const token = process.env.OPS_GITEE_TOKEN;
    const url = new URL(`https://gitee.com/api/v5/repos/${owner}/${repo}/tags`);
    if (token) url.searchParams.set('access_token', token);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gitee 返回 ${res.status}`);
    const rows = await res.json();
    return (Array.isArray(rows) ? rows : []).map(item => ({
      name: item.name,
      sha: item.commit?.sha || '',
      published_at: item.commit?.date || null,
    }));
  }

}

DeployService.ACTIVE = ACTIVE;
DeployService.TERMINAL = TERMINAL;
DeployService.defaultParams = defaultParams;

module.exports = DeployService;
