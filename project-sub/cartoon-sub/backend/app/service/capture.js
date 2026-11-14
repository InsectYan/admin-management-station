'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');
const { bins, run, probeFile } = require('../lib/mediaTools');

const VIDEO_KINDS = [ 'video', 'i2v', 't2v', 'refmod' ];

class CaptureService extends Service {
  audioRelative(projectId, shotId) {
    return path.join('audio', String(projectId), `${shotId}.m4a`);
  }

  async latestVideo(projectId, shotId) {
    const tasks = await this.ctx.model.Task.findAll({
      where: { project_id: projectId, shot_id: shotId, status: 'success', kind: VIDEO_KINDS },
      order: [[ 'id', 'DESC' ]],
      limit: 8,
    });
    for (const task of tasks) {
      const output = await this.ctx.model.Output.findOne({
        where: { task_id: task.id, media_kind: 'video' },
        order: [[ 'id', 'DESC' ]],
      });
      if (!output?.file_path) continue;
      const absolute = resolveInside(outputRoot(this.app), output.file_path);
      if (!absolute || !fs.existsSync(absolute)) continue;
      return absolute;
    }
    return null;
  }

  audioStat(projectId, shotId) {
    const relative = this.audioRelative(projectId, shotId);
    const absolute = resolveInside(outputRoot(this.app), relative);
    if (!absolute || !fs.existsSync(absolute)) return { ready: false, mtime: 0, absolute };
    return { ready: true, mtime: Math.round(fs.statSync(absolute).mtimeMs), absolute };
  }

  async board(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const shots = await this.ctx.model.Shot.findAll({
      where: { project_id: projectId },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    const rows = [];
    for (const shot of shots) {
      const video = await this.latestVideo(projectId, shot.id);
      if (!video) continue;
      const audio = this.audioStat(projectId, shot.id);
      rows.push({
        shot_id: shot.id,
        shot_code: shot.shot_code || '',
        audio_ready: audio.ready,
        audio_mtime: audio.mtime,
      });
    }
    return { rows };
  }

  async extract(projectId, shotId) {
    const shot = await this.ctx.model.Shot.findByPk(shotId);
    if (!shot || String(shot.project_id) !== String(projectId)) this.ctx.throw(404, '分镜不存在');
    const video = await this.latestVideo(projectId, shot.id);
    if (!video) this.ctx.throw(400, '这条镜头还没有成片');
    let probed;
    try {
      probed = await probeFile(this.app, video);
    } catch (err) {
      this.ctx.throw(400, err.message || '读不到这条视频');
    }
    if (!probed.hasAudio) this.ctx.throw(400, '这条视频没有音轨');
    const relative = this.audioRelative(projectId, shot.id);
    const absolute = resolveInside(outputRoot(this.app), relative);
    if (!absolute) this.ctx.throw(400, '音轨路径无效');
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    const { ffmpeg } = bins(this.app);
    try {
      await run(ffmpeg, [ '-y', '-i', video, '-vn', '-c:a', 'aac', '-b:a', '160k', absolute ]);
    } catch (err) {
      const text = String(err.message || '');
      if (/matches no streams|does not contain any stream|Output file is empty/i.test(text)) {
        this.ctx.throw(400, '这条视频没有音轨');
      }
      throw err;
    }
    const stat = this.audioStat(projectId, shot.id);
    return { shot_id: shot.id, audio_ready: stat.ready, audio_mtime: stat.mtime };
  }

  async send(projectId, shotId) {
    const shot = await this.ctx.model.Shot.findByPk(shotId);
    if (!shot || String(shot.project_id) !== String(projectId)) this.ctx.throw(404, '分镜不存在');
    const audio = this.audioStat(projectId, shot.id);
    if (!audio.ready) this.ctx.throw(404, '还没有抽出音轨');
    this.ctx.type = 'audio/mp4';
    this.ctx.body = fs.createReadStream(audio.absolute);
  }
}

module.exports = CaptureService;
