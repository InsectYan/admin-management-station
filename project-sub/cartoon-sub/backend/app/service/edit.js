'use strict';

const fs = require('fs');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');
const { inspect, probeFile } = require('../lib/mediaTools');

const TRACK_KINDS = [ 'video', 'audio', 'subtitle' ];

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sameStamp(left, right) {
  const a = new Date(left).getTime();
  const b = new Date(right).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

function reflowVideo(clips) {
  const ordered = clips.slice().sort((a, b) => a.sort_order - b.sort_order);
  let cursor = 0;
  ordered.forEach((clip, index) => {
    clip.sort_order = index;
    clip.start_ms = cursor;
    cursor += clip.duration_ms;
  });
  return { clips: ordered, durationMs: cursor };
}

class EditService extends Service {
  async projectOrThrow(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    return project;
  }

  async videoOutputs(projectId) {
    const tasks = await this.ctx.model.Task.findAll({
      where: { project_id: projectId, status: 'success' },
    });
    const taskIds = tasks.map(item => item.id);
    if (!taskIds.length) return [];
    const outputs = await this.ctx.model.Output.findAll({
      where: { task_id: taskIds, media_kind: 'video' },
      order: [[ 'id', 'DESC' ]],
    });
    const shots = await this.ctx.model.Shot.findAll({ where: { project_id: projectId } });
    const shotById = new Map(shots.map(shot => [ shot.id, shot ]));
    const taskById = new Map(tasks.map(task => [ task.id, task ]));
    return outputs.map(output => {
      const task = taskById.get(output.task_id);
      const shot = task ? shotById.get(task.shot_id) : null;
      return { output, task, shot };
    });
  }

  async probeMissing(rows) {
    const root = outputRoot(this.app);
    const pending = rows.filter(item => !item.output.duration_ms).slice(0, 20);
    for (const item of pending) {
      const absolute = resolveInside(root, item.output.file_path);
      if (!absolute || !fs.existsSync(absolute)) continue;
      try {
        this.ctx.logger.info('[cartoon] ffprobe output %s', item.output.id);
        const info = await probeFile(this.app, absolute);
        await item.output.update({
          duration_ms: info.durationMs,
          width: info.width,
          height: info.height,
        });
      } catch (err) {
        this.ctx.logger.warn('[cartoon] ffprobe 跳过 %s：%s', item.output.id, err.message);
      }
    }
  }

  presentVideo(item) {
    const root = outputRoot(this.app);
    const absolute = resolveInside(root, item.output.file_path);
    return {
      id: item.output.id,
      shot_id: item.shot?.id || item.task?.shot_id || null,
      sort_order: item.shot?.sort_order ?? null,
      description: item.shot?.description || '',
      duration_ms: item.output.duration_ms,
      width: item.output.width,
      height: item.output.height,
      missing: !absolute || !fs.existsSync(absolute),
    };
  }

  async loadGraph(edit) {
    const tracks = await this.ctx.model.EditTrack.findAll({
      where: { edit_id: edit.id },
      order: [[ 'id', 'ASC' ]],
    });
    const trackIds = tracks.map(track => track.id);
    const clips = trackIds.length
      ? await this.ctx.model.EditClip.findAll({
        where: { track_id: trackIds },
        order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
      })
      : [];
    return { tracks, clips };
  }

  presentEdit(edit, graph, videoRows) {
    const byOutput = new Map(videoRows.map(item => [ item.output.id, item ]));
    const root = outputRoot(this.app);
    return {
      id: edit.id,
      project_id: edit.project_id,
      title: edit.title,
      width: edit.width,
      height: edit.height,
      fps: edit.fps,
      duration_ms: edit.duration_ms,
      status: edit.status,
      updated_at: iso(edit.updated_at),
      tracks: graph.tracks.map(track => ({
        id: track.id,
        kind: track.kind,
        volume: Number(track.volume),
        muted: track.muted,
        clips: graph.clips.filter(clip => clip.track_id === track.id).map(clip => {
          const source = clip.source_output_id ? byOutput.get(clip.source_output_id) : null;
          const absolute = source ? resolveInside(root, source.output.file_path) : null;
          return {
            id: clip.id,
            sort_order: clip.sort_order,
            source_output_id: clip.source_output_id,
            start_ms: clip.start_ms,
            duration_ms: clip.duration_ms,
            trim_in_ms: clip.trim_in_ms,
            text: clip.text || '',
            missing: Boolean(clip.source_output_id) && (!absolute || !fs.existsSync(absolute)),
            source_duration_ms: source?.output.duration_ms ?? null,
            shot_description: source?.shot?.description || '',
          };
        }),
      })),
    };
  }

  async presentProject(projectId) {
    const project = await this.projectOrThrow(projectId);
    const videoRows = await this.videoOutputs(project.id);
    await this.probeMissing(videoRows);
    const tools = await inspect(this.app);
    const edit = await this.ctx.model.Edit.findOne({ where: { project_id: project.id } });
    let presented = null;
    let exports = [];
    if (edit) {
      const graph = await this.loadGraph(edit);
      presented = this.presentEdit(edit, graph, videoRows);
      const jobs = await this.ctx.model.EditJob.findAll({
        where: { edit_id: edit.id, status: 'success' },
        order: [[ 'id', 'DESC' ]],
        limit: 5,
      });
      exports = jobs.filter(job => job.output_id).map(job => ({
        id: job.output_id,
        job_id: job.id,
        created_at: iso(job.created_at),
      }));
    }
    return {
      project: { id: project.id, name: project.name },
      tools,
      edit: presented,
      videos: videoRows.map(item => this.presentVideo(item)).sort((a, b) => {
        const order = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        return order || b.id - a.id;
      }),
      exports,
    };
  }

  async ensureTracks(edit, transaction) {
    const existing = await this.ctx.model.EditTrack.findAll({
      where: { edit_id: edit.id },
      transaction,
    });
    const have = new Set(existing.map(track => track.kind));
    for (const kind of TRACK_KINDS) {
      if (have.has(kind)) continue;
      await this.ctx.model.EditTrack.create({
        edit_id: edit.id,
        kind,
        volume: 1,
        muted: false,
      }, { transaction });
    }
  }

  async placeVideos(edit, videoRows, transaction) {
    const track = await this.ctx.model.EditTrack.findOne({
      where: { edit_id: edit.id, kind: 'video' },
      transaction,
    });
    await this.ctx.model.EditClip.destroy({ where: { track_id: track.id }, transaction });
    const root = outputRoot(this.app);
    const shots = new Map();
    videoRows.forEach(item => {
      const shotId = item.shot?.id;
      if (!shotId || shots.has(shotId)) return;
      shots.set(shotId, item);
    });
    const orderedShots = [ ...shots.values() ].sort((a, b) => (a.shot?.sort_order ?? 0) - (b.shot?.sort_order ?? 0));
    const skipped = [];
    const chosen = [];
    orderedShots.forEach(item => {
      const absolute = resolveInside(root, item.output.file_path);
      if (!item.output.duration_ms) skipped.push({ shot_id: item.shot.id, reason: '读不到时长' });
      else if (!absolute || !fs.existsSync(absolute)) skipped.push({ shot_id: item.shot.id, reason: '文件不在磁盘上' });
      else chosen.push(item);
    });
    videoRows.forEach(item => {
      if (!item.shot) skipped.push({ shot_id: item.task?.shot_id || null, reason: '分镜不存在' });
    });
    if (!chosen.length) {
      this.ctx.throw(400, '没有可入轨的视频');
    }
    let cursor = 0;
    for (let index = 0; index < chosen.length; index += 1) {
      const item = chosen[index];
      await this.ctx.model.EditClip.create({
        track_id: track.id,
        sort_order: index,
        source_output_id: item.output.id,
        start_ms: cursor,
        duration_ms: item.output.duration_ms,
        trim_in_ms: 0,
        text: null,
      }, { transaction });
      cursor += item.output.duration_ms;
    }
    return { durationMs: cursor, skipped, first: chosen[0].output };
  }

  async seed(projectId, body) {
    const project = await this.projectOrThrow(projectId);
    const replace = Boolean(body?.replace);
    const videoRows = await this.videoOutputs(project.id);
    await this.probeMissing(videoRows);
    const existing = await this.ctx.model.Edit.findOne({ where: { project_id: project.id } });
    if (existing && !replace) this.ctx.throw(409, '已有时间线，如需重排请使用重新从产物排列');
    if (!existing && replace) this.ctx.throw(404, '还没有时间线');
    const trx = await this.ctx.model.transaction();
    try {
      let edit = existing;
      let canvas = null;
      if (!edit) {
        edit = await this.ctx.model.Edit.create({
          project_id: project.id,
          title: `${project.name} 成片`,
          width: 720,
          height: 1280,
          fps: 24,
          duration_ms: 0,
          status: 'draft',
        }, { transaction: trx });
      }
      await this.ensureTracks(edit, trx);
      const placed = await this.placeVideos(edit, videoRows, trx);
      if (!existing) {
        canvas = {
          width: placed.first.width || 720,
          height: placed.first.height || 1280,
        };
      }
      await edit.update({
        duration_ms: placed.durationMs,
        status: 'draft',
        ...(canvas || {}),
      }, { transaction: trx });
      await trx.commit();
      const payload = await this.presentProject(project.id);
      return { ...payload, skipped: placed.skipped };
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  normalizeTracks(body) {
    const incoming = Array.isArray(body?.tracks) ? body.tracks : [];
    const byKind = new Map(incoming.map(track => [ track.kind, track ]));
    return TRACK_KINDS.map(kind => {
      const track = byKind.get(kind) || { clips: [] };
      const clips = Array.isArray(track.clips) ? track.clips : [];
      return { kind, volume: track.volume, muted: track.muted, clips };
    });
  }

  async save(projectId, body) {
    const project = await this.projectOrThrow(projectId);
    const edit = await this.ctx.model.Edit.findOne({ where: { project_id: project.id } });
    if (!edit) this.ctx.throw(404, '还没有时间线');
    if (!body?.updated_at || !sameStamp(body.updated_at, edit.updated_at)) {
      this.ctx.throw(409, '时间线已在其他地方保存，请刷新后再改');
    }
    const videoRows = await this.videoOutputs(project.id);
    const byOutput = new Map(videoRows.map(item => [ item.output.id, item ]));
    const tracks = this.normalizeTracks(body);
    const video = tracks.find(track => track.kind === 'video');
    const videoClips = video.clips.map((clip, index) => {
      const sourceId = Number(clip.source_output_id);
      const source = byOutput.get(sourceId);
      if (!source) this.ctx.throw(400, '视频片段要绑定本项目的成功视频');
      const durationMs = Math.round(Number(clip.duration_ms));
      const trimIn = Math.round(Number(clip.trim_in_ms || 0));
      if (!source.output.duration_ms) this.ctx.throw(400, '素材没有时长');
      if (!Number.isFinite(durationMs) || durationMs <= 0) this.ctx.throw(400, '片段时长必须大于 0');
      if (!Number.isFinite(trimIn) || trimIn < 0) this.ctx.throw(400, '入点无效');
      if (trimIn + durationMs > source.output.duration_ms + 50) this.ctx.throw(400, '裁剪超出素材时长');
      return {
        sort_order: index,
        source_output_id: sourceId,
        duration_ms: durationMs,
        trim_in_ms: trimIn,
        text: null,
      };
    });
    const flowed = reflowVideo(videoClips);
    const subtitle = tracks.find(track => track.kind === 'subtitle');
    const subtitleClips = subtitle.clips.map(clip => ({
      start_ms: Math.round(Number(clip.start_ms)),
      duration_ms: Math.round(Number(clip.duration_ms)),
      text: String(clip.text || '').trim(),
      source_output_id: null,
      trim_in_ms: 0,
    }));
    subtitleClips.sort((a, b) => a.start_ms - b.start_ms);
    let prevEnd = 0;
    subtitleClips.forEach(clip => {
      if (!clip.text) this.ctx.throw(400, '字幕需要文字');
      if (!Number.isFinite(clip.duration_ms) || clip.duration_ms <= 0) this.ctx.throw(400, '字幕时长必须大于 0');
      if (!Number.isFinite(clip.start_ms) || clip.start_ms < 0 || clip.start_ms + clip.duration_ms > flowed.durationMs) {
        this.ctx.throw(400, '字幕超出成片');
      }
      if (clip.start_ms < prevEnd) this.ctx.throw(400, '字幕重叠');
      prevEnd = clip.start_ms + clip.duration_ms;
    });
    const audio = tracks.find(track => track.kind === 'audio');
    if (audio.clips.length) this.ctx.throw(400, '音频轨尚未开放');
    const width = Math.round(Number(body.width ?? edit.width));
    const height = Math.round(Number(body.height ?? edit.height));
    const fps = Math.round(Number(body.fps ?? edit.fps));
    if (width < 160 || width > 3840 || height < 160 || height > 3840) this.ctx.throw(400, '画布尺寸超出范围');
    if (fps < 1 || fps > 60) this.ctx.throw(400, '帧率超出范围');
    const volume = Math.min(1, Math.max(0, Number(audio.volume ?? 1)));
    const trx = await this.ctx.model.transaction();
    try {
      await this.ensureTracks(edit, trx);
      const stored = await this.ctx.model.EditTrack.findAll({ where: { edit_id: edit.id }, transaction: trx });
      const trackByKind = new Map(stored.map(track => [ track.kind, track ]));
      await trackByKind.get('audio').update({
        volume: Number.isFinite(volume) ? volume : 1,
        muted: Boolean(audio.muted),
      }, { transaction: trx });
      for (const track of stored) {
        await this.ctx.model.EditClip.destroy({ where: { track_id: track.id }, transaction: trx });
      }
      for (const clip of flowed.clips) {
        await this.ctx.model.EditClip.create({
          track_id: trackByKind.get('video').id,
          ...clip,
          start_ms: clip.start_ms,
        }, { transaction: trx });
      }
      for (let index = 0; index < subtitleClips.length; index += 1) {
        await this.ctx.model.EditClip.create({
          track_id: trackByKind.get('subtitle').id,
          sort_order: index,
          ...subtitleClips[index],
        }, { transaction: trx });
      }
      await edit.update({
        title: body.title ? String(body.title).slice(0, 200) : edit.title,
        width,
        height,
        fps,
        duration_ms: flowed.durationMs,
        status: 'draft',
      }, { transaction: trx });
      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
    return this.presentProject(project.id);
  }
}

module.exports = EditService;
