'use strict';

const Service = require('egg').Service;

const OPEN = [ 'pending', 'running' ];
const VIDEO_KINDS = [ 'video', 'i2v', 't2v', 'refmod' ];
const WAIT_LIMIT_MS = 40 * 60 * 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rollSeed() {
  const digits = 8 + Math.floor(Math.random() * 3);
  const min = 10 ** (digits - 1);
  return min + Math.floor(Math.random() * (10 ** digits - min));
}

function skipped(message) {
  const err = new Error(message);
  err.skip = true;
  return err;
}

function stopped(err) {
  const message = String(err?.message || '');
  return err?.stop
    || err?.name === 'AbortError'
    || message === '已停止'
    || message.includes('已停止');
}

class AutoJobService extends Service {
  async itemsOf(jobId) {
    return this.ctx.model.AutoJobItem.findAll({
      where: { job_id: jobId },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
  }

  present(job, items) {
    return {
      id: job.id,
      project_id: job.project_id,
      status: job.status,
      total: job.total,
      done: job.done,
      success_count: job.success_count,
      failed_count: job.failed_count,
      skipped_count: job.skipped_count,
      items: items.map(item => ({
        id: item.id,
        sort_order: item.sort_order,
        shot_id: item.shot_id,
        shot_code: item.shot_code,
        status: item.status,
        reason: item.reason || '',
        task_id: item.task_id,
        updated_at: item.updated_at,
      })),
    };
  }

  async show(jobId) {
    const job = await this.ctx.model.AutoJob.findByPk(jobId);
    if (!job) return null;
    return this.present(job, await this.itemsOf(job.id));
  }

  async current(projectId) {
    const running = await this.ctx.model.AutoJob.findOne({
      where: { project_id: projectId, status: 'running' },
      order: [[ 'id', 'DESC' ]],
    });
    const job = running || await this.ctx.model.AutoJob.findOne({
      where: { project_id: projectId },
      order: [[ 'id', 'DESC' ]],
    });
    if (!job) return null;
    return this.present(job, await this.itemsOf(job.id));
  }

  async recount(job) {
    const items = await this.itemsOf(job.id);
    const done = items.filter(item => !OPEN.includes(item.status)).length;
    await job.update({
      done,
      success_count: items.filter(item => item.status === 'success').length,
      failed_count: items.filter(item => item.status === 'failed').length,
      skipped_count: items.filter(item => item.status === 'skipped').length,
    });
    return items;
  }

  async videoPayload(projectId, shot) {
    const prompt = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
    const positive = String(prompt?.positive_zh || '').trim();
    if (!positive) throw skipped(`${shot.shot_code || shot.id} 没有视频提示词`);
    const workflows = await this.ctx.service.generate.choices();
    const savedWorkflow = workflows.find(entry => entry.id === Number(shot.workflow_id) && entry.media === 'video');
    const bindings = await this.ctx.model.ShotBinding.findAll({ where: { shot_id: shot.id } });
    const bound = bindings.map(item => Number(item.asset_id)).filter(id => id > 0);
    let hasRef = false;
    if (!savedWorkflow && bound.length) {
      const packs = await this.ctx.service.refmod.list(projectId);
      const packAssets = new Set((Array.isArray(packs) ? packs : []).map(entry => Number(entry.asset_id)));
      hasRef = bound.some(id => packAssets.has(id));
    }
    const workflow = savedWorkflow
      || (hasRef
        ? workflows.find(entry => entry.media === 'video' && /满血-h3-文生视频/i.test(entry.name) && /\[refmod\]/i.test(entry.name))
        : null)
      || workflows.find(entry => entry.media === 'video' && entry.name === '满血-h3-文生视频')
      || workflows.find(entry => entry.media === 'video' && String(entry.name).includes('文生视频') && !/refmod/i.test(entry.name));
    if (!workflow) throw new Error('没有找到文生视频工作流');
    if (hasRef && !/\[refmod\]/i.test(workflow.name)) {
      throw new Error('这条镜头绑了 RefMod 参考图，但没有找到能引用这些图的 [RefMod] 工作流');
    }
    const kind = /\[refmod\]/i.test(workflow.name) ? 'refmod' : 't2v';
    return {
      kind,
      data: {
        positive_zh: positive,
        negative_zh: prompt?.negative_zh || '',
        workflow_id: workflow.id,
        asset_ids: bound,
        duration_sec: shot.duration_ms ? Math.round(shot.duration_ms / 1000) : 10,
        seed: rollSeed(),
      },
    };
  }

  async start(projectId, shotIds) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const ids = [ ...new Set((Array.isArray(shotIds) ? shotIds : []).map(id => Number(id)).filter(id => id > 0)) ];
    if (!ids.length) this.ctx.throw(400, '请选择镜头');
    const active = await this.ctx.model.AutoJob.findOne({ where: { project_id: project.id, status: 'running' } });
    if (active) this.ctx.throw(409, '已有自动生成在后台执行');
    const liveVideo = await this.ctx.model.Task.findOne({
      where: {
        project_id: project.id,
        status: [ 'queued', 'running', 'saving' ],
        kind: VIDEO_KINDS,
      },
    });
    if (liveVideo) this.ctx.throw(409, '上一条视频还没结束');
    const shots = await this.ctx.model.Shot.findAll({ where: { project_id: project.id, id: ids } });
    const byId = new Map(shots.map(shot => [ shot.id, shot ]));
    const ordered = ids.map(id => byId.get(id));
    if (ordered.some(shot => !shot)) this.ctx.throw(400, '有镜头不在当前项目里');
    const job = await this.ctx.model.AutoJob.create({
      project_id: project.id,
      status: 'running',
      total: ordered.length,
    });
    await this.ctx.model.AutoJobItem.bulkCreate(ordered.map((shot, index) => ({
      job_id: job.id,
      sort_order: index,
      shot_id: shot.id,
      shot_code: shot.shot_code || String(shot.id),
      status: 'pending',
      reason: '',
    })));
    const jobId = job.id;
    setImmediate(() => {
      this.app.createAnonymousContext().service.autoJob.walk(jobId)
        .catch(err => this.app.logger.error('[cartoon] 自动生成中断 %s', err));
    });
    return this.show(job.id);
  }

  async halt(projectId) {
    const jobs = await this.ctx.model.AutoJob.findAll({ where: { project_id: projectId, status: 'running' } });
    for (const job of jobs) {
      await job.update({ status: 'stopped' });
      await this.ctx.model.AutoJobItem.update(
        { status: 'stopped', reason: '已停止' },
        { where: { job_id: job.id, status: 'pending' } },
      );
    }
    return jobs.length;
  }

  async failInterrupted() {
    const jobs = await this.ctx.model.AutoJob.findAll({ where: { status: 'running' } });
    for (const job of jobs) {
      await job.update({ status: 'stopped' });
      await this.ctx.model.AutoJobItem.update(
        { status: 'stopped', reason: '服务重启，这一条没有继续提交' },
        { where: { job_id: job.id, status: OPEN } },
      );
      await this.recount(job);
    }
  }

  async finishStopped(job, item, task) {
    await item.update({
      status: 'stopped',
      reason: '已停止',
      task_id: task?.id || item.task_id,
    });
    if (job.status === 'running') await job.update({ status: 'stopped' });
    await this.ctx.model.AutoJobItem.update(
      { status: 'stopped', reason: '已停止' },
      { where: { job_id: job.id, status: 'pending' } },
    );
    await this.recount(job);
  }

  async liveVideos(projectId) {
    return this.ctx.model.Task.findAll({
      where: {
        project_id: projectId,
        status: [ 'queued', 'running', 'saving' ],
        kind: VIDEO_KINDS,
      },
      order: [[ 'id', 'ASC' ]],
    });
  }

  async stillRunning(job) {
    const fresh = await job.reload();
    return fresh.status === 'running';
  }

  async waitForIdleVideo(job) {
    while (await this.stillRunning(job)) {
      const live = await this.liveVideos(job.project_id);
      if (!live.length) return true;
      const queue = await this.ctx.service.generate.comfyQueue();
      await this.ctx.service.generate.settleTask(live[0], queue);
      const settled = await live[0].reload();
      if ([ 'queued', 'running', 'saving' ].includes(settled.status)) await sleep(3000);
    }
    return false;
  }

  async waitForTask(job, task) {
    const deadline = Date.now() + WAIT_LIMIT_MS;
    while (await this.stillRunning(job)) {
      const fresh = await this.ctx.model.Task.findByPk(task.id);
      if (!fresh) return { stopped: false, task: null };
      if ([ 'success', 'failed', 'cancelled' ].includes(fresh.status)) {
        return { stopped: fresh.status === 'cancelled', task: fresh };
      }
      if (Date.now() > deadline) {
        if (fresh.prompt_id) await this.ctx.service.generate.dropComfyPrompts([ fresh.prompt_id ]);
        await fresh.update({ status: 'failed', error_message: '这一条等待超时' });
        return { stopped: false, task: await fresh.reload() };
      }
      const queue = await this.ctx.service.generate.comfyQueue();
      await this.ctx.service.generate.settleTask(fresh, queue);
      const settled = await fresh.reload();
      if ([ 'success', 'failed', 'cancelled' ].includes(settled.status)) {
        return { stopped: settled.status === 'cancelled', task: settled };
      }
      await sleep(3000);
    }
    const latest = await this.ctx.model.Task.findByPk(task.id);
    return { stopped: true, task: latest };
  }

  async walk(jobId) {
    const job = await this.ctx.model.AutoJob.findByPk(jobId);
    if (!job || job.status !== 'running') return;
    const items = await this.itemsOf(job.id);
    for (const item of items) {
      if (!await this.stillRunning(job)) {
        await this.ctx.model.AutoJobItem.update(
          { status: 'stopped', reason: '已停止' },
          { where: { job_id: job.id, status: 'pending' } },
        );
        await this.recount(job);
        return;
      }
      if (item.status !== 'pending') continue;
      await item.update({ status: 'running', reason: '等待上一条生成结束' });
      await this.recount(job);
      try {
        const idle = await this.waitForIdleVideo(job);
        if (!idle) {
          await this.finishStopped(job, item, null);
          return;
        }
        const shot = await this.ctx.model.Shot.findByPk(item.shot_id);
        if (!shot || String(shot.project_id) !== String(job.project_id)) {
          throw new Error('镜头已不在项目里');
        }
        await item.update({ reason: '正在提交' });
        const payload = await this.videoPayload(job.project_id, shot);
        let task = await this.ctx.service.generate.start(job.project_id, shot.id, payload.data, payload.kind);
        if (!task?.id) throw new Error('没有拿到生成任务');
        await item.update({ task_id: task.id, reason: '正在生成' });
        if ([ 'queued', 'running', 'saving' ].includes(task.status)) {
          const waited = await this.waitForTask(job, task);
          if (waited.stopped) {
            await this.finishStopped(job, item, waited.task);
            return;
          }
          task = waited.task;
        }
        if (!task || task.status === 'cancelled') {
          await this.finishStopped(job, item, task);
          return;
        }
        if (task.status === 'failed') {
          const reason = task.error_message || '视频生成失败';
          const missing = reason.includes('没有正向提示词') || reason.includes('没有视频提示词') || reason.includes('需要一句提示词') || reason.includes('需要一句视频提示词');
          await item.update({
            status: missing ? 'skipped' : 'failed',
            reason,
            task_id: task.id,
          });
        } else if (task.status === 'success') {
          await item.update({ status: 'success', reason: '视频已生成', task_id: task.id });
        } else {
          await item.update({ status: 'failed', reason: '视频没有生成', task_id: task.id });
        }
      } catch (err) {
        if (stopped(err)) {
          await this.finishStopped(job, item, null);
          return;
        }
        await item.update({
          status: err?.skip ? 'skipped' : 'failed',
          reason: err?.message || '失败',
        });
      }
      await this.recount(job);
    }
    const latest = await job.reload();
    if (latest.status === 'running') await latest.update({ status: 'done' });
    await this.recount(latest);
  }
}

module.exports = AutoJobService;
