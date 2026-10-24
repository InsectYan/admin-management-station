'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Service = require('egg').Service;
const { presetList, presetOf } = require('../lib/exportPresets');
const { complianceCheck } = require('../lib/complianceCheck');
const { outputRoot, resolveInside } = require('../lib/mediaPaths');
const { bins, run, inspect, probeFile } = require('../lib/mediaTools');

class DeliveryService extends Service {
  async requireProject(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    return project;
  }

  async videoOutputs(projectId) {
    const { Op } = this.app.Sequelize;
    const tasks = await this.ctx.model.Task.findAll({
      where: { project_id: projectId },
      attributes: [ 'id' ],
    });
    const taskIds = tasks.map(item => item.id);
    const rows = taskIds.length
      ? await this.ctx.model.Output.findAll({
        where: { task_id: { [Op.in]: taskIds }, media_kind: 'video' },
        order: [[ 'id', 'DESC' ]],
      })
      : [];
    const edit = await this.ctx.model.Edit.findOne({ where: { project_id: projectId } });
    if (edit) {
      const job = await this.ctx.model.EditJob.findOne({
        where: { edit_id: edit.id, output_id: { [Op.ne]: null } },
        order: [[ 'id', 'DESC' ]],
      });
      if (job?.output_id) {
        const output = await this.ctx.model.Output.findByPk(job.output_id);
        if (output?.media_kind === 'video') rows.push(output);
      }
    }
    return rows.filter(item => item.duration_ms && item.file_path && this.absoluteFile(item.file_path));
  }

  absoluteFile(relative) {
    const absolute = resolveInside(outputRoot(this.app), relative);
    if (!absolute || !fs.existsSync(absolute)) return null;
    return absolute;
  }

  async specs(projectId) {
    await this.requireProject(projectId);
    const rows = await this.ctx.model.ExportSpec.findAll({
      where: { project_id: projectId },
      order: [[ 'id', 'DESC' ]],
    });
    return { presets: presetList(), rows };
  }

  async createSpec(projectId, payload) {
    await this.requireProject(projectId);
    const preset = presetOf(payload.preset);
    if (!preset) this.ctx.throw(400, '规格不存在');
    const lang = String(payload.lang || '').trim();
    if (payload.preset === 'multi_lang' && !lang) this.ctx.throw(400, '多语种需要填写语言');
    const videos = await this.videoOutputs(projectId);
    const master = videos[0] || null;
    const row = await this.ctx.model.ExportSpec.create({
      project_id: Number(projectId),
      preset: payload.preset,
      width: preset.width,
      height: preset.height,
      fps: preset.fps,
      bitrate_kbps: preset.bitrate_kbps,
      format: preset.format,
      subtitle_mode: preset.subtitle_mode,
      voice_track: preset.voice_track,
      bgm_track: preset.bgm_track,
      cover_note: String(payload.cover_note || '').trim(),
      lang,
      status: master ? 'encoding' : 'waiting_master',
      source_output_id: master ? master.id : null,
    });
    if (!master) return row;
    try {
      await this.encode(row, master, preset);
    } catch (err) {
      await row.update({ status: 'failed', error_message: String(err.message || err).slice(0, 500) });
      throw err;
    }
    return row.reload();
  }

  fontFile() {
    const candidates = [
      '/usr/share/fonts/wqy-zenhei/wqy-zenhei.ttc',
      '/usr/share/fonts/wenquanyi/wqy-zenhei/wqy-zenhei.ttc',
    ];
    return candidates.find(item => fs.existsSync(item)) || '';
  }

  filterPath(file) {
    return file.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/,/g, '\\,').replace(/'/g, '\\\'');
  }

  async subtitleCues(projectId, durationMs) {
    const shots = await this.ctx.model.Shot.findAll({
      where: { project_id: projectId },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    const lines = shots.map(item => String(item.dialogue || '').trim()).filter(Boolean);
    if (!lines.length || durationMs <= 0) return [];
    const slice = Math.max(400, Math.floor(durationMs / lines.length));
    return lines.map((text, index) => ({
      start: Math.min(durationMs, index * slice),
      end: Math.min(durationMs, (index + 1) * slice),
      text,
    })).filter(item => item.end > item.start);
  }

  toSrt(cues) {
    const stamp = ms => {
      const hour = String(Math.floor(ms / 3600000)).padStart(2, '0');
      const minute = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
      const second = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
      const milli = String(ms % 1000).padStart(3, '0');
      return `${hour}:${minute}:${second},${milli}`;
    };
    return cues.map((item, index) => `${index + 1}\n${stamp(item.start)} --> ${stamp(item.end)}\n${item.text}\n`).join('\n');
  }

  async bgmFile(projectId) {
    const rows = await this.ctx.model.Asset.findAll({
      where: { project_id: projectId, kind: 'bgm', disabled: false },
      order: [[ 'id', 'DESC' ]],
    });
    for (const row of rows) {
      const file = this.absoluteFile(row.reference_path);
      if (file) return file;
    }
    return null;
  }

  async encode(row, master, preset) {
    const tools = await inspect(this.app);
    if (!tools.ffmpeg || !tools.ffprobe) this.ctx.throw(400, '本机没有 ffmpeg，只能预览');
    const source = this.absoluteFile(master.file_path);
    if (!source) this.ctx.throw(400, '成片文件不在磁盘上');
    const relative = `${row.project_id}/specs/${row.id}/episode.mp4`;
    const target = resolveInside(outputRoot(this.app), relative);
    if (!target) this.ctx.throw(400, '导出路径无效');
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    const info = await probeFile(this.app, source);
    const full = info.durationMs / 1000;
    const seconds = row.preset === 'short' ? Math.min(15, full) : full;
    const durationMs = Math.round(seconds * 1000);
    const cues = preset.subtitle_mode === 'burn' ? await this.subtitleCues(row.project_id, durationMs) : [];
    const compliance = await complianceCheck(this.ctx, '', { stage: 'export' });
    const mark = Boolean(compliance && compliance.ai_mark);
    const font = (cues.length || mark) ? this.fontFile() : '';
    if ((cues.length || mark) && !font) this.ctx.throw(400, '本机没有中文字体，不能烧录字幕');
    let srt = '';
    if (cues.length) {
      srt = resolveInside(outputRoot(this.app), `${row.project_id}/specs/${row.id}/episode.srt`);
      await fs.promises.writeFile(srt, this.toSrt(cues));
    }
    const video = `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2`;
    const pieces = [ video ];
    if (srt) pieces.push(`subtitles=${this.filterPath(srt)}:fontsdir=${this.filterPath(path.dirname(font))}`);
    if (mark) {
      pieces.push(`drawtext=fontfile=${this.filterPath(font)}:text='AI生成':x=w-tw-24:y=24:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.45`);
    }
    const burn = pieces.join(',');
    const bgm = preset.bgm_track ? await this.bgmFile(row.project_id) : null;
    const args = [ '-y', '-i', source ];
    if (bgm) args.push('-i', bgm);
    args.push('-t', seconds.toFixed(3));
    const keepVoice = preset.voice_track && info.hasAudio;
    if (bgm && keepVoice) {
      args.push(
        '-filter_complex',
        `[0:v]${burn}[v];[1:a]volume=0.35[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0[a]`,
        '-map', '[v]', '-map', '[a]',
      );
    } else if (bgm) {
      args.push('-vf', burn, '-map', '0:v', '-map', '1:a');
    } else {
      args.push('-vf', burn);
    }
    args.push('-r', String(preset.fps), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-b:v', `${preset.bitrate_kbps}k`);
    if (bgm || keepVoice) args.push('-c:a', 'aac', '-b:a', '96k');
    else args.push('-an');
    if (mark) args.push('-metadata', 'comment=AI生成', '-metadata', 'description=AI生成');
    args.push('-movflags', '+faststart', target);
    await run(bins(this.app).ffmpeg, args);
    const probed = await probeFile(this.app, target);
    if (row.preset === 'multi_lang' && row.lang) {
      const sidecar = relative.replace(/\.mp4$/, '.vtt');
      const vtt = resolveInside(outputRoot(this.app), sidecar);
      await fs.promises.writeFile(vtt, `WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n${row.lang}\n`);
    }
    await row.update({
      status: 'encoded',
      file_path: relative,
      duration_ms: probed.durationMs,
      width: probed.width || preset.width,
      height: probed.height || preset.height,
      error_message: bgm || !preset.bgm_track ? '' : '没有背景音乐文件，这一版保留原声',
      burned_subtitle: Boolean(srt),
      mixed_bgm: Boolean(bgm),
      ai_marked: mark,
    });
  }

  async lineage(outputId) {
    const output = await this.ctx.model.Output.findByPk(outputId);
    if (!output) this.ctx.throw(404, '产物不存在');
    let project = null;
    let task = null;
    if (output.task_id) {
      task = await this.ctx.model.Task.findByPk(output.task_id);
      if (task) project = await this.ctx.model.Project.findByPk(task.project_id);
    }
    if (!project && output.edit_job_id) {
      const job = await this.ctx.model.EditJob.findByPk(output.edit_job_id);
      const edit = job ? await this.ctx.model.Edit.findByPk(job.edit_id) : null;
      if (edit) project = await this.ctx.model.Project.findByPk(edit.project_id);
    }
    if (!project) this.ctx.throw(404, '产物不存在');
    const assets = await this.ctx.model.Asset.findAll({
      where: { project_id: project.id },
      attributes: [ 'id' ],
      order: [[ 'id', 'ASC' ]],
    });
    return {
      output_id: output.id,
      project_id: project.id,
      package_id: project.package_id || '',
      package_version: task?.package_version || project.package_version || null,
      asset_ids: assets.map(item => item.id),
      model_profile: task?.model_profile || '',
      workflow_id: task?.precheck_workflow_id || null,
      operator_name: task?.operator_name || '',
    };
  }

  async markFace(outputId, payload) {
    const output = await this.ctx.model.Output.findByPk(outputId);
    if (!output) this.ctx.throw(404, '产物不存在');
    if (typeof payload.ok !== 'boolean') this.ctx.throw(400, '需要标明有没有串脸');
    await output.update({ face_checked: true, face_ok: payload.ok });
    return output;
  }

  async sendFile(id) {
    const row = await this.ctx.model.ExportSpec.findByPk(id);
    if (!row?.file_path) this.ctx.throw(404, '规格文件不存在');
    const absolute = this.absoluteFile(row.file_path);
    if (!absolute) this.ctx.throw(404, '规格文件不存在');
    this.ctx.type = 'mp4';
    this.ctx.body = fs.createReadStream(absolute);
  }

  async outputInProject(projectId, outputId) {
    const output = await this.ctx.model.Output.findByPk(outputId);
    if (!output) return null;
    if (output.task_id) {
      const task = await this.ctx.model.Task.findByPk(output.task_id);
      if (task && String(task.project_id) === String(projectId)) return output;
    }
    if (output.edit_job_id) {
      const job = await this.ctx.model.EditJob.findByPk(output.edit_job_id);
      const edit = job ? await this.ctx.model.Edit.findByPk(job.edit_id) : null;
      if (edit && String(edit.project_id) === String(projectId)) return output;
    }
    return null;
  }

  async frameDiff(projectId, leftId, rightId) {
    await this.requireProject(projectId);
    if (!leftId || !rightId) this.ctx.throw(400, '需要选择两侧产物');
    if (String(leftId) === String(rightId)) this.ctx.throw(400, '不能和自己对比');
    const left = await this.outputInProject(projectId, leftId);
    const right = await this.outputInProject(projectId, rightId);
    if (!left || !right) this.ctx.throw(404, '产物不存在');
    if (!left.duration_ms || !right.duration_ms) this.ctx.throw(400, '缺少时长，不能逐帧对比');
    const step = 1000;
    const max = Math.max(left.duration_ms, right.duration_ms);
    const count = Math.min(8, Math.ceil(max / step));
    const leftFile = this.absoluteFile(left.file_path);
    const rightFile = this.absoluteFile(right.file_path);
    const frames = [];
    for (let index = 0; index < count; index += 1) {
      const ms = index * step;
      const leftOn = ms < left.duration_ms;
      const rightOn = ms < right.duration_ms;
      let leftHash = '';
      let rightHash = '';
      if (leftOn && leftFile) leftHash = await this.frameHash(leftFile, ms / 1000);
      if (rightOn && rightFile) rightHash = await this.frameHash(rightFile, ms / 1000);
      const sampled = Boolean(leftHash || rightHash);
      const sameSize = left.width === right.width && left.height === right.height;
      frames.push({
        index,
        ms,
        left: leftOn,
        right: rightOn,
        sampled,
        same: sampled ? Boolean(leftHash && rightHash && leftHash === rightHash) : (leftOn && rightOn && sameSize),
      });
    }
    return {
      left_id: left.id,
      right_id: right.id,
      sampled: frames.some(item => item.sampled),
      frames,
    };
  }

  async frameHash(file, seconds) {
    const tmp = path.join(os.tmpdir(), `cartoon-frame-${crypto.randomBytes(6).toString('hex')}.png`);
    try {
      await run(bins(this.app).ffmpeg, [
        '-y', '-ss', seconds.toFixed(3), '-i', file,
        '-frames:v', '1', '-vf', 'scale=16:16', tmp,
      ]);
      const buf = await fs.promises.readFile(tmp);
      return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
    } catch (err) {
      this.ctx.logger.warn('[frame] %s', err.message);
      return '';
    } finally {
      await fs.promises.rm(tmp, { force: true }).catch(() => {});
    }
  }

  async previewProfiles(outputId) {
    const output = await this.ctx.model.Output.findByPk(outputId);
    if (!output) this.ctx.throw(404, '产物不存在');
    const projectId = await this.projectOfOutput(output);
    const specs = projectId
      ? await this.ctx.model.ExportSpec.findAll({ where: { project_id: projectId, status: 'encoded' } })
      : [];
    const byPreset = new Map(specs.filter(item => item.file_path).map(item => [ item.preset, item ]));
    const own = `outputs/${output.id}/file`;
    const fileFor = preset => {
      const spec = byPreset.get(preset);
      return spec ? `export-specs/${spec.id}/file` : own;
    };
    return {
      output_id: output.id,
      media_kind: output.media_kind,
      file: own,
      profiles: [
        { id: 'phone', label: '手机', ratio: '9 / 16', file: fileFor('portrait') },
        { id: 'tablet', label: '平板', ratio: '3 / 4', file: fileFor('tablet') },
        { id: 'desktop', label: '桌面', ratio: '16 / 9', file: fileFor('landscape') },
      ],
    };
  }

  async projectOfOutput(output) {
    if (output.task_id) {
      const task = await this.ctx.model.Task.findByPk(output.task_id);
      if (task) return task.project_id;
    }
    if (output.edit_job_id) {
      const job = await this.ctx.model.EditJob.findByPk(output.edit_job_id);
      const edit = job ? await this.ctx.model.Edit.findByPk(job.edit_id) : null;
      if (edit) return edit.project_id;
    }
    return null;
  }
}

module.exports = DeliveryService;
