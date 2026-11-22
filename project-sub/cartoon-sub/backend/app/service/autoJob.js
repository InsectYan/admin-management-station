'use strict';

const Service = require('egg').Service;
const { promptCoveredMs, fitDurationSec } = require('../lib/promptDuration');

const OPEN = [ 'pending', 'running' ];
const VIDEO_KINDS = [ 'video', 'i2v', 't2v', 'refmod' ];
const WAIT_LIMIT_MS = 2 * 60 * 60 * 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rollSeed() {
  const digits = 8 + Math.floor(Math.random() * 3);
  const min = 10 ** (digits - 1);
  return min + Math.floor(Math.random() * (10 ** digits - min));
}

function takeFreshSeed(bag) {
  let seed = rollSeed();
  for (let attempt = 0; attempt < 12 && bag.has(seed); attempt += 1) seed = rollSeed();
  bag.add(seed);
  return seed;
}

function skipped(message) {
  const err = new Error(message);
  err.skip = true;
  return err;
}

function readFailures(item) {
  const raw = item?.failures;
  if (Array.isArray(raw)) return raw.slice();
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stopped(err) {
  const message = String(err?.message || '');
  return err?.stop
    || err?.name === 'AbortError'
    || message === '已停止'
    || message.includes('已停止');
}

function alignedSize(width, height) {
  const ok = value => Number.isInteger(value) && value >= 64 && value <= 2048 && value % 32 === 0;
  const w = Number(width);
  const h = Number(height);
  if (ok(w) && ok(h)) return { width: w, height: h };
  return { width: 1024, height: 1024 };
}

function missingPrompt(message) {
  return /没有视频提示词|没有返回视频提示词|没有正向提示词|需要一句提示词|需要一句视频提示词/.test(String(message || ''));
}

class AutoJobService extends Service {
  takeSeed(job) {
    if (!this.seedBags) this.seedBags = new Map();
    const key = Number(job?.id) || 0;
    if (!this.seedBags.has(key)) this.seedBags.set(key, new Set());
    return takeFreshSeed(this.seedBags.get(key));
  }

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
        failures: readFailures(item),
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

  async videoPayload(job, shot) {
    const projectId = job.project_id;
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
      || workflows.find(entry => entry.media === 'video' && /满血-h3-首尾帧/i.test(entry.name) && /\[refmod\]/i.test(entry.name))
      || workflows.find(entry => entry.media === 'video' && String(entry.name).includes('首尾帧') && /\[refmod\]/i.test(entry.name));
    if (!workflow) throw new Error('没有找到满血 H3 首尾帧 RefMod 工作流');
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
        duration_sec: (() => {
          const covered = promptCoveredMs(positive);
          const proposed = covered ? covered / 1000 : (shot.duration_ms ? shot.duration_ms / 1000 : 10);
          return fitDurationSec(proposed, shot.dialogue, proposed);
        })(),
        seed: this.takeSeed(job),
      },
    };
  }

  async mediaPlan(project, generateEnd) {
    const workflows = await this.ctx.service.generate.choices();
    const video = workflows.find(entry => entry.media === 'video'
      && /满血-h3-首尾帧/i.test(entry.name)
      && /\[refmod\]/i.test(entry.name));
    if (!video) this.ctx.throw(400, '没有找到满血 H3 首尾帧 RefMod 工作流');
    if (generateEnd && !(video.images || []).some(slot => slot.role === 'end')) {
      this.ctx.throw(400, '满血首尾帧工作流没有尾帧入口');
    }
    const images = workflows.filter(entry => entry.media === 'image' && !/反推|改图/.test(entry.name || ''));
    const runs = await this.ctx.model.FullRun.findAll({
      where: { project_id: project.id },
      order: [[ 'id', 'DESC' ]],
      limit: 30,
    });
    const lastFrame = runs.find(row => Number(row.frame_workflow_id) > 0);
    let frame = lastFrame && images.find(entry => entry.id === Number(lastFrame.frame_workflow_id));
    if (!frame) {
      frame = images.find(entry => /图生图/.test(entry.name) && /heretic/i.test(entry.name))
        || images.find(entry => /图生图/.test(entry.name))
        || images.find(entry => !/图生图/.test(entry.name));
    }
    if (!frame) this.ctx.throw(400, '没有找到首尾帧出图工作流');
    const frameSize = lastFrame && Number(lastFrame.frame_workflow_id) === Number(frame.id)
      ? alignedSize(lastFrame.frame_width, lastFrame.frame_height)
      : alignedSize(frame.width, frame.height);
    const lastAsset = runs.find(row => Number(row.asset_workflow_id) > 0);
    const asset = lastAsset && images.find(entry => entry.id === Number(lastAsset.asset_workflow_id) && !/图生图/.test(entry.name));
    const assetSize = asset
      ? alignedSize(lastAsset.asset_width, lastAsset.asset_height)
      : alignedSize(0, 0);
    return { video, frame, frameSize, assetId: asset ? asset.id : 0, assetSize };
  }

  lastTracked(job) {
    try {
      const ids = JSON.parse(job?.task_ids || '[]');
      const last = Number(ids[ids.length - 1]);
      return Number.isInteger(last) && last > 0 ? last : null;
    } catch {
      return null;
    }
  }

  async start(projectId, shotIds, videoCountValue, generateEnd, fresh) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const ids = [ ...new Set((Array.isArray(shotIds) ? shotIds : []).map(id => Number(id)).filter(id => id > 0)) ];
    if (!ids.length) this.ctx.throw(400, '请选择镜头');
    const perShot = Math.round(Number(videoCountValue == null || videoCountValue === '' ? 1 : videoCountValue));
    if (!Number.isInteger(perShot) || perShot < 1 || perShot > 8) this.ctx.throw(400, '每个镜头的视频条数需要是 1 到 8');
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
    ordered.sort((a, b) => (Number(a.sort_order) - Number(b.sort_order)) || (Number(a.id) - Number(b.id)));
    const plan = await this.mediaPlan(project, generateEnd !== false);
    const job = await this.ctx.model.AutoJob.create({
      project_id: project.id,
      status: 'running',
      total: ordered.length,
      frame_workflow_id: plan.frame.id,
      frame_width: plan.frameSize.width,
      frame_height: plan.frameSize.height,
      video_workflow_id: plan.video.id,
      asset_workflow_id: plan.assetId,
      asset_width: plan.assetSize.width,
      asset_height: plan.assetSize.height,
      video_count: perShot,
      generate_end: generateEnd !== false,
      fresh: fresh === true || fresh === 1 || fresh === '1' || fresh === 'true',
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
      this.ctx.service.fullAuto.abort(`job:${job.id}`);
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
    const { startMediaWatch } = require('../lib/executionTrace');
    const watch = await startMediaWatch(this.ctx, task);
    const started = Date.now();
    try {
      const result = await this.waitForTaskBody(job, task);
      const fresh = result?.task;
      const state = result?.stopped
        ? 'skip'
        : (!fresh ? 'error' : (fresh.status === 'success' ? 'ok' : (fresh.status === 'cancelled' ? 'skip' : 'error')));
      await watch.close(state, fresh?.error_message || '', Date.now() - started);
      return result;
    } catch (err) {
      await watch.close('error', err?.message || '失败', Date.now() - started);
      throw err;
    }
  }

  async waitForTaskBody(job, task) {
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

  async failOrRetry(job, item, reason, taskId) {
    const failures = readFailures(item);
    const message = String(reason || '失败').slice(0, 500);
    failures.push({
      at: new Date().toISOString(),
      count: failures.length + 1,
      message,
    });
    const stored = JSON.stringify(failures);
    await item.update({
      status: 'failed',
      reason: message,
      failures: stored,
      task_id: taskId || null,
    });
    item.status = 'failed';
    item.failures = stored;
    return 'next';
  }

  async walk(jobId) {
    const job = await this.ctx.model.AutoJob.findByPk(jobId);
    if (!job || job.status !== 'running') return;
    const items = await this.itemsOf(job.id);
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
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
        job.signal_key = `job:${job.id}`;
        if (Number(job.import_id) !== Number(shot.import_id || 0)) {
          await job.update({ import_id: shot.import_id || null });
          job.import_id = shot.import_id || null;
          job.signal_key = `job:${job.id}`;
        }
        if (Number(shot.workflow_id) !== Number(job.video_workflow_id)) {
          await shot.update({ workflow_id: job.video_workflow_id });
        }
        const chapter = shot.import_id ? await this.ctx.model.Import.findByPk(shot.import_id) : null;
        const scene = this.ctx.service.fullAuto.sceneLabel(chapter?.script_data || {}, shot);
        const prev = await this.ctx.service.fullAuto.previousShot(shot);
        const same = Boolean(prev) && this.ctx.service.fullAuto.sharesScene(shot, prev);
        const videoChoice = await this.ctx.service.generate.choiceById(job.video_workflow_id);
        const endSlot = (videoChoice?.images || []).find(slot => slot.role === 'end') || null;
        const perShot = Math.max(1, Math.min(8, Math.round(Number(job.video_count) || 1)));
        const wantEnd = job.generate_end !== false;
        let lastTaskId = null;
        for (let nth = 0; nth < perShot; nth += 1) {
          const idle = await this.waitForIdleVideo(job);
          if (!idle) {
            await this.finishStopped(job, item, null);
            return;
          }
          await item.update({
            reason: perShot > 1 ? `正在生成第 ${nth + 1}/${perShot} 条的首帧和视频` : '正在生成首帧和视频',
          });
          job.signal_key = `job:${job.id}`;
          const startedAt = job.created_at || job.createdAt || null;
          const chain = job.fresh
            ? await this.ctx.service.fullAuto.taskChainIndex(job.project_id, shot, prev, startedAt, nth)
            : { plantIndex: nth, tailIndex: nth };
          await this.ctx.service.fullAuto.shoot(job, shot, endSlot, same, scene, {
            batchIndex: chain.plantIndex,
            tailIndex: chain.tailIndex,
            wantEnd,
          });
          lastTaskId = this.lastTracked(job);
          await item.update({
            task_id: lastTaskId,
            reason: perShot > 1 ? `第 ${nth + 1}/${perShot} 条已生成` : '视频已生成',
          });
        }
        await item.update({
          status: 'success',
          reason: perShot > 1 ? `已生成 ${perShot} 条视频` : '视频已生成',
          task_id: lastTaskId,
        });
        item.status = 'success';
      } catch (err) {
        if (stopped(err)) {
          await this.finishStopped(job, item, null);
          return;
        }
        if (err?.skip || missingPrompt(err?.message)) {
          await item.update({ status: 'skipped', reason: err?.message || '跳过', task_id: this.lastTracked(job) });
          item.status = 'skipped';
        } else {
          await this.failOrRetry(job, item, err?.message || '失败', this.lastTracked(job));
        }
      }
      await this.recount(job);
    }
    const latest = await job.reload();
    if (latest.status === 'running') await latest.update({ status: 'done' });
    await this.recount(latest);
  }
}

module.exports = AutoJobService;
