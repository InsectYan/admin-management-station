'use strict';

const { Service } = require('egg');

const MOCK_LINES = [
  { level: 'info', message: '[tag] 校验仅允许 master，准备按 tag 部署（mock）' },
  { level: 'info', message: '[tag] 远程已存在该 tag，记录 sha' },
  { level: 'info', message: '[fetch] git fetch --depth 1 origin tag' },
  { level: 'info', message: '[fetch] checkout 到工作区 /tmp/ops-deploy/{jobId}' },
  { level: 'info', message: '[build] 按项目类型执行构建命令' },
  { level: 'info', message: '[build] npm ci' },
  { level: 'info', message: '[build] npm run build' },
  { level: 'warn', message: '[build] 提示：生产构建未开启 sourcemap（mock）' },
  { level: 'info', message: '[check] 检查产物目录' },
  { level: 'info', message: '[check] 退出码 0' },
  { level: 'info', message: '[done] mock 部署完成' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class DeployMockService extends Service {
  enabled() {
    return process.env.OPS_DEPLOY_MOCK !== '0';
  }

  kick(jobId) {
    if (!this.enabled()) return;
    const { app } = this;
    setImmediate(() => {
      const ctx = app.createAnonymousContext();
      ctx.service.deployMock.run(jobId).catch(err => {
        app.logger.error('[DeployMock] job %s failed: %s', jobId, err.message);
      });
    });
  }

  async resumeQueued() {
    if (!this.enabled()) return;
    const rows = await this.ctx.model.OpsDeployJob.findAll({
      where: { status: 'queued' },
      attributes: [ 'id' ],
    });
    for (const row of rows) this.kick(row.id);
  }

  async run(jobId) {
    const deploy = this.ctx.service.deploy;
    let job = await deploy.getJob(jobId);
    if (job.status !== 'queued') return;

    await sleep(400);
    job = await deploy.getJob(jobId);
    if (job.status !== 'queued') return;

    job = await deploy.patchStatus(jobId, {
      status: 'running',
      started_at: new Date(),
      git_sha: 'mock' + String(jobId).padStart(7, '0'),
    });

    const product = job.params?.product || 'generic';
    const demoLines = product !== 'generic' && product !== 'agentrun'
      ? [
        { level: 'info', message: `[demo] 产品 ${product} 本期只演示配置，不登录云厂商` },
        { level: 'info', message: '[demo] 已读取项目部署配置模块（演示）' },
        { level: 'info', message: '[done] demo 部署完成' },
      ]
      : MOCK_LINES;
    for (const item of demoLines) {
      await sleep(280);
      job = await deploy.getJob(jobId);
      if (job.status !== 'running') return;
      const message = item.message.replace('{jobId}', String(jobId));
      await deploy.appendLog(jobId, { level: item.level, message });
    }
    job = await deploy.getJob(jobId);
    if (job.status !== 'running') return;
    await deploy.patchStatus(jobId, {
      status: 'success',
      finished_at: new Date(),
    });
  }
}

module.exports = DeployMockService;
