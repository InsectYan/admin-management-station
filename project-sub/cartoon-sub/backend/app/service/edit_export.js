'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, tmpEditRoot, resolveInside } = require('../lib/mediaPaths');
const { bins, run, inspect, probeFile, parseOutTimeMs } = require('../lib/mediaTools');

let busy = false;

function even(value) {
  const number = Math.max(2, Math.round(Number(value) || 2));
  return number % 2 === 0 ? number : number - 1;
}

function presentJob(job) {
  return {
    id: job.id,
    edit_id: job.edit_id,
    status: job.status,
    progress: job.progress,
    error_message: job.error_message,
    output_id: job.output_id,
  };
}

class EditExportService extends Service {
  async failInterrupted() {
    await this.ctx.model.EditJob.update(
      { status: 'failed', error_message: '进程重启，导出中断' },
      { where: { status: [ 'queued', 'running' ] } },
    );
  }

  async show(id) {
    const job = await this.ctx.model.EditJob.findByPk(id);
    if (!job) this.ctx.throw(404, '导出任务不存在');
    return presentJob(job);
  }

  async start(projectId) {
    if (busy) this.ctx.throw(409, '已有导出任务在进行');
    busy = true;
    try {
      const running = await this.ctx.model.EditJob.findOne({
        where: { status: [ 'queued', 'running' ] },
      });
      if (running) this.ctx.throw(409, '已有导出任务在进行');
      const tools = await inspect(this.app);
      if (!tools.ffmpeg || !tools.ffprobe) this.ctx.throw(400, '本机没有 ffmpeg，只能预览');
      await this.ctx.service.edit.projectOrThrow(projectId);
      const edit = await this.ctx.model.Edit.findOne({ where: { project_id: projectId } });
      if (!edit) this.ctx.throw(404, '还没有时间线');
      await this.clipsForExport(edit);
      const job = await this.ctx.model.EditJob.create({
        edit_id: edit.id,
        status: 'queued',
        progress: 0,
      });
      const jobId = job.id;
      setImmediate(() => {
        this.app.createAnonymousContext().service.editExport.run(jobId)
          .catch(err => this.app.logger.error('[cartoon] 导出失败 %s', err));
      });
      return presentJob(job);
    } catch (err) {
      busy = false;
      throw err;
    }
  }

  async clipsForExport(edit) {
    const track = await this.ctx.model.EditTrack.findOne({
      where: { edit_id: edit.id, kind: 'video' },
    });
    if (!track) this.ctx.throw(400, '时间线上没有视频');
    const clips = await this.ctx.model.EditClip.findAll({
      where: { track_id: track.id },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    if (!clips.length) this.ctx.throw(400, '时间线上没有视频');
    const rows = await this.ctx.service.edit.videoOutputs(edit.project_id);
    const byId = new Map(rows.map(item => [ item.output.id, item ]));
    const root = outputRoot(this.app);
    return clips.map(clip => {
      const source = byId.get(clip.source_output_id);
      const absolute = source ? resolveInside(root, source.output.file_path) : null;
      if (!source || !absolute || !fs.existsSync(absolute)) this.ctx.throw(400, '有片段的素材缺失，不能导出');
      if (!source.output.duration_ms) this.ctx.throw(400, '有片段还没有时长，请重新打开剪辑页');
      if (clip.trim_in_ms + clip.duration_ms > source.output.duration_ms + 50) {
        this.ctx.throw(400, '有片段的裁剪超出素材时长');
      }
      return { clip, absolute };
    });
  }

  async run(jobId) {
    const job = await this.ctx.model.EditJob.findByPk(jobId);
    if (!job) {
      busy = false;
      return;
    }
    const tmp = path.join(tmpEditRoot(this.app), String(job.id));
    const commands = [];
    try {
      await job.update({ status: 'running', progress: 0, error_message: null });
      const edit = await this.ctx.model.Edit.findByPk(job.edit_id);
      const pieces = await this.clipsForExport(edit);
      await fs.promises.mkdir(tmp, { recursive: true });
      const width = even(edit.width);
      const height = even(edit.height);
      const fps = edit.fps || 24;
      const segmentPaths = [];
      for (let index = 0; index < pieces.length; index += 1) {
        const segment = path.join(tmp, `seg-${index}.mp4`);
        const args = await this.segmentArgs(pieces[index], segment, { width, height, fps });
        commands.push(args);
        await this.spawn(args, async outMs => {
          const ratio = (index + Math.min(outMs, pieces[index].clip.duration_ms) / pieces[index].clip.duration_ms) / pieces.length;
          await this.touchProgress(job, Math.min(99, Math.round(ratio * 100)));
        });
        segmentPaths.push(segment);
      }
      const root = outputRoot(this.app);
      const relative = `${edit.project_id}/edit/${job.id}/episode.mp4`;
      const target = resolveInside(root, relative);
      if (!target) throw new Error('成片路径无效');
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      const listPath = path.join(tmp, 'list.txt');
      const list = segmentPaths.map(file => `file '${file.replace(/\\/g, '/').replace(/'/g, `'\\''`)}'`).join('\n');
      await fs.promises.writeFile(listPath, list);
      const concatArgs = [
        '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
        '-c', 'copy', '-movflags', '+faststart',
        '-progress', 'pipe:1', '-nostats', target,
      ];
      commands.push(concatArgs);
      await job.update({ args_snapshot: commands, progress: 99 });
      await this.spawn(concatArgs);
      const output = await this.ctx.model.Output.create({
        task_id: null,
        edit_job_id: job.id,
        file_path: relative,
        media_kind: 'video',
        duration_ms: edit.duration_ms,
        width,
        height,
      });
      await job.update({ status: 'success', progress: 100, output_id: output.id, error_message: null });
      await edit.update({ status: 'exported' });
    } catch (err) {
      this.ctx.logger.error('[cartoon] 导出任务 %s 失败：%s', jobId, err);
      await job.update({
        status: 'failed',
        args_snapshot: commands.length ? commands : job.args_snapshot,
        error_message: String(err.message || err).slice(0, 2000),
      });
    } finally {
      busy = false;
      await fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  }

  async segmentArgs(piece, target, canvas) {
    const info = await probeFile(this.app, piece.absolute);
    const ss = (piece.clip.trim_in_ms / 1000).toFixed(3);
    const dur = (piece.clip.duration_ms / 1000).toFixed(3);
    const vf = `scale=${canvas.width}:${canvas.height}:force_original_aspect_ratio=decrease,pad=${canvas.width}:${canvas.height}:(ow-iw)/2:(oh-ih)/2,fps=${canvas.fps}`;
    const args = [ '-y', '-ss', ss, '-t', dur, '-i', piece.absolute ];
    if (info.hasAudio) args.push('-map', '0:v:0', '-map', '0:a:0');
    else {
      args.push(
        '-f', 'lavfi', '-t', dur, '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
        '-map', '0:v:0', '-map', '1:a:0',
      );
    }
    args.push(
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
      '-t', dur,
      '-progress', 'pipe:1', '-nostats',
      target,
    );
    return args;
  }

  async spawn(args, onOutMs) {
    const { ffmpeg } = bins(this.app);
    let buffer = '';
    let lastWrite = 0;
    await run(ffmpeg, args, {
      onStdout: text => {
        if (!onOutMs) return;
        buffer += text;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        lines.forEach(line => {
          const outMs = parseOutTimeMs(line);
          if (outMs == null) return;
          const now = Date.now();
          if (now - lastWrite < 400) return;
          lastWrite = now;
          onOutMs(outMs).catch(err => this.ctx.logger.warn('[cartoon] 进度写入失败：%s', err.message));
        });
      },
    });
  }

  async touchProgress(job, progress) {
    if (progress <= job.progress) return;
    job.progress = progress;
    await job.update({ progress });
  }
}

module.exports = EditExportService;
