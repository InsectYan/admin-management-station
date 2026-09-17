'use strict';

const { Service } = require('egg');
const { isDemoProduct, isAgentrun } = require('../lib/deployProducts');

class DeployDispatchService extends Service {
  productOf(job) {
    return job?.params?.product || job?.project?.deploy_config?.product || 'generic';
  }

  useMock(job) {
    const flag = process.env.OPS_DEPLOY_MOCK;
    if (flag === '1') return true;
    const product = this.productOf(job);
    if (isDemoProduct(product)) return true;
    if (isAgentrun(product)) return flag === '1';
    if (flag === '0') return false;
    const source = job?.params?.code_source;
    if (source === 'local') return false;
    const remote = String(job?.git_remote || '');
    return !/^https?:\/\/(github\.com|gitee\.com)\//i.test(remote);
  }

  kick(jobId) {
    const { app } = this;
    setImmediate(() => {
      const ctx = app.createAnonymousContext();
      ctx.service.deployDispatch.run(jobId).catch(err => {
        app.logger.error('[DeployDispatch] job %s failed: %s', jobId, err.message);
      });
    });
  }

  async resumeQueued() {
    const rows = await this.ctx.model.OpsDeployJob.findAll({
      where: { status: 'queued' },
      attributes: [ 'id' ],
    });
    for (const row of rows) this.kick(row.id);
  }

  async run(jobId) {
    const job = await this.ctx.service.deploy.getJob(jobId);
    if (job.status !== 'queued') return;
    if (this.useMock(job)) {
      await this.ctx.service.deployMock.run(jobId);
      return;
    }
    await this.ctx.service.deployRunner.run(jobId);
  }
}

module.exports = DeployDispatchService;
