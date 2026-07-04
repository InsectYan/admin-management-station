'use strict';

const Service = require('egg').Service;

const WORKER_INTERVAL_MS = 3000;

function queueState(app) {
  if (!app._generationQueueState) {
    app._generationQueueState = {
      workerTimer: null,
      processing: false,
      currentJobId: null,
      finishedNotices: [],
    };
  }
  return app._generationQueueState;
}

class GenerationQueueService extends Service {
  async enqueue({ jobId, taskName, payload, projectCode, projectName }) {
    const Queue = this.ctx.model.GenerationJobQueue;
    const maxRow = await Queue.findOne({
      order: [[ 'queue_order', 'DESC' ], [ 'id', 'DESC' ]],
      attributes: [ 'queue_order' ],
    });
    const queueOrder = (maxRow?.queue_order ?? 0) + 1;

    await Queue.create({
      job_id: jobId,
      task_name: taskName,
      queue_status: 'waiting',
      queue_order: queueOrder,
      payload: payload || {},
      progress_percent: 0,
      current_phase: 'analyze',
      project_code: projectCode,
      project_name: projectName,
    });

    const job = await this.ctx.model.GenerationJob.findByPk(jobId);
    if (job && job.status !== 'paused') {
      await job.update({
        status: 'waiting',
        agent_context: {
          ...(job.agent_context || {}),
          current_direction: '已加入队列，等待执行…',
          updated_at: new Date().toISOString(),
        },
      });
    }

    await this.ensureWorker();
    return { job_id: jobId, queue_status: 'waiting' };
  }

  async list() {
    const rows = await this.ctx.model.GenerationJobQueue.findAll({
      order: [[ 'queue_order', 'ASC' ], [ 'id', 'ASC' ]],
    });

    const waitingIds = rows
      .filter(r => r.queue_status === 'waiting')
      .map(r => r.job_id);

    const list = rows.map(row => {
      const json = row.toJSON();
      const waitIndex = waitingIds.indexOf(json.job_id);
      return {
        id: json.id,
        job_id: json.job_id,
        task_name: json.task_name,
        queue_status: json.queue_status,
        queue_order: json.queue_order,
        progress_percent: json.progress_percent ?? 0,
        current_phase: json.current_phase || 'analyze',
        project_code: json.project_code,
        project_name: json.project_name,
        wait_position: json.queue_status === 'waiting' && waitIndex >= 0 ? waitIndex + 1 : null,
        created_at: json.created_at,
        updated_at: json.updated_at,
      };
    });

    const state = queueState(this.app);
    const finished_notices = [ ...state.finishedNotices ];
    state.finishedNotices = [];

    return { list, finished_notices, worker_active: Boolean(state.workerTimer) };
  }

  async syncProgress(jobId, { progressPercent, currentPhase } = {}) {
    const row = await this.ctx.model.GenerationJobQueue.findOne({ where: { job_id: jobId } });
    if (!row) return;
    const updates = { updated_at: new Date() };
    if (progressPercent != null) updates.progress_percent = progressPercent;
    if (currentPhase) updates.current_phase = currentPhase;
    if (row.queue_status === 'waiting') {
      updates.queue_status = 'running';
    }
    await row.update(updates);
  }

  async pause(jobId) {
    const job = await this.ctx.model.GenerationJob.findByPk(jobId);
    if (!job) {
      const err = new Error('任务不存在');
      err.status = 404;
      throw err;
    }
    if (![ 'waiting', 'running' ].includes(job.status)) {
      const err = new Error(`当前状态不可暂停：${job.status}`);
      err.status = 400;
      throw err;
    }

    await job.update({
      status: 'paused',
      agent_context: {
        ...(job.agent_context || {}),
        current_direction: '任务已暂停，可从任务列表恢复',
        updated_at: new Date().toISOString(),
      },
    });

    const row = await this.ctx.model.GenerationJobQueue.findOne({ where: { job_id: jobId } });
    if (row) {
      await row.update({ queue_status: 'paused', updated_at: new Date() });
    }

    const state = queueState(this.app);
    if (state.currentJobId === Number(jobId)) {
      state.processing = false;
      state.currentJobId = null;
    }

    setImmediate(() => this.processNext().catch(err => {
      this.ctx.app.logger.error('[generationQueue] processNext after pause: %s', err.message);
    }));

    return { job_id: jobId, status: 'paused' };
  }

  async resume(jobId) {
    const job = await this.ctx.model.GenerationJob.findByPk(jobId);
    if (!job || job.status !== 'paused') {
      const err = new Error('只能恢复已暂停的任务');
      err.status = 400;
      throw err;
    }

    const row = await this.ctx.model.GenerationJobQueue.findOne({ where: { job_id: jobId } });
    if (!row) {
      const err = new Error('任务不在队列中');
      err.status = 404;
      throw err;
    }

    const hasRunning = await this.ctx.model.GenerationJobQueue.findOne({
      where: { queue_status: 'running' },
    });

    await job.update({
      status: hasRunning ? 'waiting' : 'waiting',
      agent_context: {
        ...(job.agent_context || {}),
        current_direction: hasRunning ? '已恢复，排队等待执行…' : '已恢复，即将开始执行…',
        updated_at: new Date().toISOString(),
      },
    });
    await row.update({
      queue_status: 'waiting',
      updated_at: new Date(),
    });

    await this.ensureWorker();
    return { job_id: jobId, status: 'waiting' };
  }

  async cancel(jobId) {
    const job = await this.ctx.model.GenerationJob.findByPk(jobId);
    if (!job) {
      const err = new Error('任务不存在');
      err.status = 404;
      throw err;
    }
    if ([ 'done', 'partial', 'failed', 'cancelled' ].includes(job.status)) {
      const err = new Error(`任务已结束：${job.status}`);
      err.status = 400;
      throw err;
    }

    await job.update({ status: 'cancelled', finished_at: new Date() });

    const row = await this.ctx.model.GenerationJobQueue.findOne({ where: { job_id: jobId } });
    const state = queueState(this.app);

    if (row) {
      if (row.queue_status === 'running' && state.currentJobId === Number(jobId)) {
        state.processing = false;
        state.currentJobId = null;
      }
      await row.destroy();
    }

    setImmediate(() => this.processNext().catch(err => {
      this.ctx.app.logger.error('[generationQueue] processNext after cancel: %s', err.message);
    }));

    return { job_id: jobId, status: 'cancelled' };
  }

  async ensureWorker() {
    const state = queueState(this.app);
    if (state.workerTimer) {
      setImmediate(() => this.processNext().catch(() => {}));
      return;
    }

    state.workerTimer = setInterval(() => {
      const ctx = this.app.createAnonymousContext();
      ctx.service.generationQueue.processNext().catch(err => {
        this.app.logger.error('[generationQueue] worker tick: %s', err.message);
      });
    }, WORKER_INTERVAL_MS);

    setImmediate(() => this.processNext().catch(err => {
      this.ctx.app.logger.error('[generationQueue] initial processNext: %s', err.message);
    }));
  }

  async stopWorkerIfIdle() {
    const state = queueState(this.app);
    if (state.processing) return;

    const count = await this.ctx.model.GenerationJobQueue.count({
      where: { queue_status: [ 'waiting', 'running', 'paused' ] },
    });
    const actionable = await this.ctx.model.GenerationJobQueue.count({
      where: { queue_status: [ 'waiting', 'running' ] },
    });

    if (actionable === 0 && state.workerTimer) {
      clearInterval(state.workerTimer);
      state.workerTimer = null;
      this.ctx.app.logger.info('[generationQueue] worker stopped (queue idle)');
    }
    if (count === 0 && !state.workerTimer) return;
  }

  async processNext() {
    const state = queueState(this.app);
    if (state.processing) return;

    const runningRow = await this.ctx.model.GenerationJobQueue.findOne({
      where: { queue_status: 'running' },
    });
    if (runningRow) return;

    const next = await this.ctx.model.GenerationJobQueue.findOne({
      where: { queue_status: 'waiting' },
      order: [[ 'queue_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    if (!next) {
      await this.stopWorkerIfIdle();
      return;
    }

    const job = await this.ctx.model.GenerationJob.findByPk(next.job_id);
    if (!job || job.status === 'cancelled' || job.status === 'paused') {
      if (job?.status === 'paused') return;
      await next.destroy().catch(() => {});
      return this.processNext();
    }

    state.processing = true;
    state.currentJobId = next.job_id;

    await next.update({ queue_status: 'running', updated_at: new Date() });
    await job.update({
      status: 'running',
      started_at: job.started_at || new Date(),
      agent_context: {
        ...(job.agent_context || {}),
        current_direction: '队列调度：开始执行生成…',
        updated_at: new Date().toISOString(),
      },
    });

    const payload = next.payload || {};
    const bgCtx = this.app.createAnonymousContext();

    try {
      await bgCtx.service.generationJob.executeJob(next.job_id, payload);
    } catch (err) {
      bgCtx.app.logger.error('[generationQueue] execute job=%s %s', next.job_id, err.message);
    } finally {
      state.processing = false;
      state.currentJobId = null;
      try {
        await bgCtx.service.generationQueue.handleJobExecutionEnd(next.job_id);
      } catch (err) {
        bgCtx.app.logger.error('[generationQueue] handleJobExecutionEnd job=%s %s', next.job_id, err.message);
      }
      setImmediate(() => {
        bgCtx.service.generationQueue.processNext().catch(() => {});
      });
    }
  }

  async handleJobExecutionEnd(jobId) {
    const row = await this.ctx.model.GenerationJobQueue.findOne({ where: { job_id: jobId } });
    if (!row) return;

    const job = await this.ctx.model.GenerationJob.findByPk(jobId);
    if (!job) {
      await row.destroy();
      return;
    }

    if (job.status === 'paused') {
      await row.update({ queue_status: 'paused', updated_at: new Date() });
      return;
    }

    const taskName = row.task_name;
    const finalStatus = job.status;
    await row.destroy();

    if ([ 'done', 'partial' ].includes(finalStatus)) {
      const state = queueState(this.app);
      state.finishedNotices.push({
        job_id: jobId,
        task_name: taskName,
        status: finalStatus,
        finished_at: new Date().toISOString(),
      });
    }

    await this.stopWorkerIfIdle();
  }

  async recoverStuckOnStartup() {
    const runningRows = await this.ctx.model.GenerationJobQueue.findAll({
      where: { queue_status: 'running' },
    });
    for (const row of runningRows) {
      await row.update({ queue_status: 'waiting', updated_at: new Date() });
      const job = await this.ctx.model.GenerationJob.findByPk(row.job_id);
      if (job?.status === 'running') {
        await job.update({
          status: 'waiting',
          agent_context: {
            ...(job.agent_context || {}),
            current_direction: '服务重启，任务已重新排队…',
            updated_at: new Date().toISOString(),
          },
        });
      }
    }
    const state = queueState(this.app);
    state.processing = false;
    state.currentJobId = null;
  }

  async reenqueueFailed(jobId, payload, taskName) {
    const existing = await this.ctx.model.GenerationJobQueue.findOne({ where: { job_id: jobId } });
    if (existing) {
      await existing.update({
        queue_status: 'waiting',
        payload: payload || existing.payload,
        updated_at: new Date(),
      });
    } else {
      await this.enqueue({
        jobId,
        taskName: taskName || `任务 #${jobId}`,
        payload,
        projectCode: payload?.project_code,
        projectName: payload?.project_name,
      });
      return;
    }
    await this.ensureWorker();
  }
}

module.exports = GenerationQueueService;
