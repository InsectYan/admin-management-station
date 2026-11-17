'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');

const FRAME_LABELS = [
  [ /^manual\.png$/, '指定首帧' ],
  [ /^end\.png$/, '指定尾帧' ],
  [ /^b\d+-/, '批次衔接图' ],
  [ /^auto\.png$/, '承接首帧' ],
];

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function targetOf(relative) {
  const match = slash(relative).match(/^frames\/(\d+)\/(\d+)\//);
  if (!match) return null;
  return { projectId: Number(match[1]), shotId: Number(match[2]) };
}

function describeFiles(names) {
  const labels = [];
  names.forEach(name => {
    const hit = FRAME_LABELS.find(([ pattern ]) => pattern.test(name));
    const label = hit ? hit[1] : name;
    if (!labels.includes(label)) labels.push(label);
  });
  return labels.join('、') || '空目录';
}

async function readDir(dir) {
  try {
    return await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
}

class TrashService extends Service {
  async list() {
    const bundle = await this.loadBundle();
    const frames = await this.frameRows(bundle);
    const frameIds = new Set(frames.map(row => row.id));
    return [ ...frames, ...this.pathRows(bundle, frameIds), ...this.traceRows(bundle) ];
  }

  async remove(rawId) {
    const id = String(rawId || '');
    const frame = id.match(/^frame:(\d+):(\d+)$/);
    if (frame) return this.removeFrame(Number(frame[1]), Number(frame[2]));
    const pointer = id.match(/^path:(\d+):(first|manual)$/);
    if (pointer) return this.removePath(Number(pointer[1]), pointer[2]);
    const trace = id.match(/^trace:(\d+)$/);
    if (trace) return this.removeTrace(Number(trace[1]));
    throw httpError(400, '这条垃圾数据无法识别');
  }

  async loadBundle() {
    const { ctx } = this;
    const [ projects, shots, imports, traces ] = await Promise.all([
      ctx.model.Project.findAll({ attributes: [ 'id', 'name', 'deleted_at' ] }),
      ctx.model.Shot.findAll({
        attributes: [ 'id', 'project_id', 'shot_code', 'import_id', 'first_frame_path', 'manual_frame_path' ],
      }),
      ctx.model.Import.findAll({ attributes: [ 'id', 'chapter_title', 'deleted_at' ] }),
      ctx.model.PromptTrace.findAll({
        attributes: [ 'id', 'project_id', 'shot_id', 'title', 'skill', 'status', 'created_at' ],
        order: [[ 'id', 'DESC' ]],
      }),
    ]);
    return {
      projects: new Map(projects.map(row => [ row.id, row ])),
      shots: new Map(shots.map(row => [ row.id, row ])),
      imports: new Map(imports.map(row => [ row.id, row ])),
      shotList: shots,
      traces,
    };
  }

  upstream(bundle, { projectId, shot, shotId }) {
    const project = bundle.projects.get(Number(projectId));
    const record = shot || null;
    const source = record ? bundle.imports.get(record.import_id) : null;
    return {
      project_name: project ? project.name : '',
      project_state: !project ? 'missing' : (project.deleted_at ? 'deleted' : 'ok'),
      snapshot_title: source ? (source.chapter_title || `快照 #${source.id}`) : '',
      snapshot_state: !record ? 'missing' : (!source ? 'missing' : (source.deleted_at ? 'deleted' : 'ok')),
      shot_label: record ? (record.shot_code || `镜头 #${record.id}`) : `镜头 #${shotId || ''}`,
      shot_state: record ? 'ok' : 'missing',
    };
  }

  async frameRows(bundle) {
    const root = outputRoot(this.app);
    const framesRoot = path.join(root, 'frames');
    const rows = [];
    const projects = await readDir(framesRoot);
    for (const projectDir of projects) {
      if (!projectDir.isDirectory() || !/^\d+$/.test(projectDir.name)) continue;
      const projectId = Number(projectDir.name);
      const shotDirs = await readDir(path.join(framesRoot, projectDir.name));
      for (const shotDir of shotDirs) {
        if (!shotDir.isDirectory() || !/^\d+$/.test(shotDir.name)) continue;
        const shotId = Number(shotDir.name);
        if (bundle.shots.has(shotId)) continue;
        const absolute = resolveInside(root, `frames/${projectId}/${shotId}`);
        if (!absolute) continue;
        const files = (await readDir(absolute)).filter(entry => entry.isFile()).map(entry => entry.name);
        const prefix = `frames/${projectId}/${shotId}/`;
        const pointers = [];
        bundle.shotList.forEach(shot => {
          [[ 'first_frame_path', '首帧路径' ], [ 'manual_frame_path', '指定帧路径' ]].forEach(([ field, label ]) => {
            if (slash(shot[field]).startsWith(prefix)) {
              pointers.push(`${shot.shot_code || `镜头 #${shot.id}`} 的${label}`);
            }
          });
        });
        const detail = [ describeFiles(files), pointers.length ? `${pointers.join('、')}仍指向这个目录` : '' ]
          .filter(Boolean)
          .join('。');
        rows.push({
          id: `frame:${projectId}:${shotId}`,
          kind: 'frame',
          kind_label: '帧图',
          detail,
          ...this.upstream(bundle, { projectId, shotId }),
        });
      }
    }
    return rows;
  }

  pathRows(bundle, frameIds) {
    const rows = [];
    const root = outputRoot(this.app);
    bundle.shotList.forEach(shot => {
      [[ 'first', 'first_frame_path', '首帧路径' ], [ 'manual', 'manual_frame_path', '指定帧路径' ]].forEach(([ key, field, label ]) => {
        const relative = slash(shot[field]);
        if (!relative.startsWith('frames/')) return;
        const target = targetOf(relative);
        if (target && !bundle.shots.has(target.shotId) && frameIds.has(`frame:${target.projectId}:${target.shotId}`)) return;
        const absolute = resolveInside(root, relative);
        const fileExists = absolute ? fs.existsSync(absolute) : false;
        if (fileExists && (!target || bundle.shots.has(target.shotId))) return;
        const reason = target && !bundle.shots.has(target.shotId)
          ? `${label}指向已删除镜头的目录`
          : `${label}指向的文件已经不在`;
        rows.push({
          id: `path:${shot.id}:${key}`,
          kind: 'path',
          kind_label: '帧路径',
          detail: `${reason}：${relative}`,
          ...this.upstream(bundle, { projectId: shot.project_id, shot, shotId: shot.id }),
        });
      });
    });
    return rows;
  }

  traceRows(bundle) {
    return bundle.traces
      .filter(trace => !bundle.shots.has(trace.shot_id))
      .map(trace => ({
        id: `trace:${trace.id}`,
        kind: 'trace',
        kind_label: '提示词记录',
        detail: [ trace.title || trace.skill || '提示词记录', trace.status === 'error' ? '异常' : '' ].filter(Boolean).join(' · '),
        ...this.upstream(bundle, { projectId: trace.project_id, shotId: trace.shot_id }),
      }));
  }

  async removeFrame(projectId, shotId) {
    const shot = await this.ctx.model.Shot.findByPk(shotId);
    if (shot) throw httpError(409, '这个镜头还在，不能当作垃圾清除');
    const root = outputRoot(this.app);
    const absolute = resolveInside(root, `frames/${projectId}/${shotId}`);
    if (!absolute) throw httpError(400, '帧目录超出产物范围');
    await fs.promises.rm(absolute, { recursive: true, force: true });
    const prefix = `frames/${projectId}/${shotId}/`;
    const holders = await this.ctx.model.Shot.findAll({
      where: { project_id: projectId },
      attributes: [ 'id', 'first_frame_path', 'manual_frame_path' ],
    });
    for (const holder of holders) {
      const patch = {};
      if (slash(holder.first_frame_path).startsWith(prefix)) patch.first_frame_path = '';
      if (slash(holder.manual_frame_path).startsWith(prefix)) patch.manual_frame_path = '';
      if (Object.keys(patch).length) await holder.update(patch);
    }
    return { removed: true };
  }

  async removePath(shotId, key) {
    const field = key === 'first' ? 'first_frame_path' : 'manual_frame_path';
    const shot = await this.ctx.model.Shot.findByPk(shotId);
    if (!shot) return { removed: true };
    const relative = slash(shot[field]);
    if (!relative) return { removed: true };
    const target = targetOf(relative);
    const targetAlive = target ? Boolean(await this.ctx.model.Shot.findByPk(target.shotId)) : false;
    const absolute = resolveInside(outputRoot(this.app), relative);
    const fileExists = absolute ? fs.existsSync(absolute) : false;
    if (targetAlive && fileExists) throw httpError(409, '这条路径还能对上镜头和文件');
    if (!target && fileExists) throw httpError(409, '这条路径指向的文件还在');
    await shot.update({ [field]: '' });
    return { removed: true };
  }

  async removeTrace(id) {
    const trace = await this.ctx.model.PromptTrace.findByPk(id);
    if (!trace) return { removed: true };
    const shot = await this.ctx.model.Shot.findByPk(trace.shot_id);
    if (shot) throw httpError(409, '这条提示词记录仍关联着镜头');
    await trace.destroy();
    return { removed: true };
  }
}

module.exports = TrashService;
