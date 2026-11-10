'use strict';

const Service = require('egg').Service;
const { presetOf } = require('../lib/exportPresets');

const ASSET_KINDS = {
  characters: 'character',
  scenes: 'scene',
  props: 'prop',
  voices: 'voice',
  materials: 'material',
  brands: 'brand',
};

class LibraryService extends Service {
  async names(ids) {
    const rows = ids.length
      ? await this.ctx.model.Project.findAll({ where: { id: ids } })
      : [];
    return new Map(rows.map(row => [ row.id, row ]));
  }

  async assets(kind) {
    if (kind && !ASSET_KINDS[kind]) this.ctx.throw(400, '资产分类不存在');
    const { Op } = this.app.Sequelize;
    const where = !kind
      ? {}
      : (kind === 'materials' ? { kind: { [Op.in]: [ 'bgm', 'sfx', 'subtitle_style', 'transition' ] } } : { kind: ASSET_KINDS[kind] });
    const rows = await this.ctx.model.Asset.findAll({ where, order: [[ 'id', 'DESC' ]], limit: 100 });
    const projects = await this.names([ ...new Set(rows.map(row => row.project_id)) ]);
    return rows.map(row => ({
      ...row.toJSON(),
      project_name: projects.get(row.project_id)?.name || '',
      shared_label: row.library_asset_id ? `共享 #${row.library_asset_id}` : '',
    }));
  }

  async createShared(payload) {
    const kinds = [ 'character', 'scene', 'prop', 'voice', 'brand' ];
    const name = String(payload.name || '').trim();
    if (!name) this.ctx.throw(400, '需要资产名称');
    const kind = kinds.includes(payload.kind) ? payload.kind : 'character';
    return this.ctx.model.LibraryAsset.create({
      kind,
      name,
      description: String(payload.description || '').trim(),
    });
  }

  async updateShared(id, payload) {
    const shared = await this.ctx.model.LibraryAsset.findByPk(id);
    if (!shared || shared.disabled) this.ctx.throw(404, '共享资产不存在');
    const description = String(payload.description || '').trim();
    if (!description) this.ctx.throw(400, '需要资产描述');
    const revision = shared.revision + 1;
    await shared.update({ description, revision });
    const linked = await this.ctx.model.Asset.findAll({ where: { library_asset_id: shared.id } });
    for (const asset of linked) {
      await asset.update({ description, library_revision: revision });
      const bindings = await this.ctx.model.ShotBinding.findAll({ where: { asset_id: asset.id } });
      for (const binding of bindings) {
        const shot = await this.ctx.model.Shot.findByPk(binding.shot_id);
        if (!shot) continue;
        const tasks = await this.ctx.model.Task.findAll({ where: { shot_id: shot.id, status: 'success' } });
        const outputs = tasks.length
          ? await this.ctx.model.Output.count({ where: { task_id: tasks.map(item => item.id) } })
          : 0;
        if (outputs) await shot.update({ asset_stale: true });
        else await shot.update({ description, asset_stale: false });
      }
    }
    return shared;
  }

  async linkShared(projectId, payload) {
    await this.ctx.service.project.show(projectId);
    const shared = await this.ctx.model.LibraryAsset.findByPk(payload.library_asset_id);
    if (!shared || shared.disabled) this.ctx.throw(404, '共享资产不存在');
    const existing = await this.ctx.model.Asset.findOne({
      where: { project_id: Number(projectId), library_asset_id: shared.id },
    });
    if (existing) return existing;
    return this.ctx.model.Asset.create({
      project_id: Number(projectId),
      kind: shared.kind,
      name: shared.name,
      description: shared.description,
      library_asset_id: shared.id,
      library_revision: shared.revision,
    });
  }

  async batches() {
    const rows = await this.ctx.model.Batch.findAll({ order: [[ 'id', 'DESC' ]], limit: 100 });
    const projects = await this.names([ ...new Set(rows.map(row => row.project_id)) ]);
    return rows.map(row => ({
      ...row.toJSON(),
      project_name: projects.get(row.project_id)?.name || '',
    }));
  }

  async reviews() {
    const rows = await this.ctx.model.Review.findAll({ order: [[ 'id', 'DESC' ]], limit: 100 });
    const projects = await this.names([ ...new Set(rows.map(row => row.project_id)) ]);
    return rows.map(row => ({
      id: row.id,
      project_id: row.project_id,
      project_name: projects.get(row.project_id)?.name || '',
      video_task_id: row.video_task_id,
      decision: row.decision,
      node: row.node,
      note: row.note,
    }));
  }

  async review(id) {
    const row = await this.ctx.model.Review.findByPk(id);
    if (!row) this.ctx.throw(404, '审核记录不存在');
    const project = await this.ctx.model.Project.findByPk(row.project_id);
    return {
      ...row.toJSON(),
      project_name: project?.name || '',
    };
  }

  async versions() {
    const rows = await this.ctx.model.Project.findAll({
      where: { deleted_at: null },
      order: [[ 'id', 'DESC' ]],
    });
    const [ shots, tasks, outputs ] = await Promise.all([
      this.ctx.model.Shot.findAll({ attributes: [ 'id', 'project_id' ] }),
      this.ctx.model.Task.findAll({ attributes: [ 'id', 'shot_id', 'status' ] }),
      this.ctx.model.Output.findAll({ attributes: [ 'id', 'task_id', 'version_stage' ] }),
    ]);
    const taskById = new Map(tasks.map(item => [ item.id, item ]));
    const renderedShots = new Set();
    const stages = new Map();
    for (const output of outputs) {
      const task = taskById.get(output.task_id);
      if (!task?.shot_id) continue;
      renderedShots.add(task.shot_id);
      const bucket = stages.get(task.shot_id) || { generated: 0, revised: 0, final: 0 };
      const stage = [ 'generated', 'revised', 'final' ].includes(output.version_stage) ? output.version_stage : 'generated';
      bucket[stage] += 1;
      stages.set(task.shot_id, bucket);
    }
    const labels = { draft: '草稿', generated: '生成版', revised: '修改版', final: '最终交付版' };
    return rows.map(row => {
      const counts = { draft: 0, generated: 0, revised: 0, final: 0 };
      for (const shot of shots.filter(item => item.project_id === row.id)) {
        if (!renderedShots.has(shot.id)) counts.draft += 1;
        const bucket = stages.get(shot.id);
        if (bucket) {
          counts.generated += bucket.generated;
          counts.revised += bucket.revised;
          counts.final += bucket.final;
        }
      }
      const stage_summary = [ 'draft', 'generated', 'revised', 'final' ]
        .filter(key => counts[key])
        .map(key => `${labels[key]} ${counts[key]}`)
        .join(' · ') || '还没有成片';
      return {
        id: row.id,
        name: row.name,
        content_type: row.content_type,
        pin_mode: row.pin_mode,
        package_id: row.package_id,
        package_version: row.package_version,
        stage_summary,
      };
    });
  }

  async exports() {
    const edits = await this.ctx.model.Edit.findAll({ order: [[ 'id', 'DESC' ]], limit: 100 });
    const projects = await this.names(edits.map(row => row.project_id));
    const result = [];
    for (const edit of edits) {
      const job = await this.ctx.model.EditJob.findOne({
        where: { edit_id: edit.id },
        order: [[ 'id', 'DESC' ]],
      });
      result.push({
        id: edit.id,
        project_id: edit.project_id,
        project_name: projects.get(edit.project_id)?.name || '',
        title: edit.title,
        status: job?.status || edit.status,
        width: edit.width,
        height: edit.height,
      });
    }
    const specs = await this.ctx.model.ExportSpec.findAll({ order: [[ 'id', 'DESC' ]], limit: 100 });
    const specProjects = await this.names([ ...new Set(specs.map(row => row.project_id)) ]);
    for (const spec of specs) {
      result.push({
        id: spec.id,
        project_id: spec.project_id,
        project_name: specProjects.get(spec.project_id)?.name || '',
        title: presetOf(spec.preset)?.label || spec.preset,
        status: spec.status,
        width: spec.width,
        height: spec.height,
        kind: 'spec',
      });
    }
    return result;
  }

  presentOutput(output, task, shot, project, snapshot) {
    const brief = task?.generation_brief || {};
    return {
      id: output.id,
      media_kind: output.media_kind,
      version_stage: output.version_stage,
      duration_ms: output.duration_ms,
      width: output.width,
      height: output.height,
      face_checked: output.face_checked,
      face_ok: output.face_ok,
      created_at: output.created_at,
      project_id: project?.id || task?.project_id || null,
      project_name: project?.name || '',
      project_deleted: Boolean(project?.deleted_at) || !project,
      shot_id: shot?.id || task?.shot_id || null,
      shot_code: shot?.shot_code || '',
      snapshot_id: snapshot?.id || null,
      snapshot_title: snapshot?.chapter_title || '',
      snapshot_deleted: Boolean(snapshot?.deleted_at),
      task: task ? {
        id: task.id,
        kind: task.kind,
        status: task.status,
        error_message: task.error_message || '',
        operator_name: task.operator_name || '',
        model_profile: task.model_profile || '',
        generation: {
          workflow_id: brief.workflow_id || null,
          workflow_name: brief.workflow_name || '',
          positive: brief.positive || '',
          negative: brief.negative || '',
          assets: Array.isArray(brief.assets) ? brief.assets : [],
          assets_recorded: Array.isArray(brief.assets),
          seed: brief.seed ?? null,
          duration_sec: brief.duration_sec ?? null,
        },
      } : null,
    };
  }

  async outputContext(rows) {
    const taskIds = [ ...new Set(rows.map(row => row.task_id).filter(Boolean)) ];
    const tasks = taskIds.length
      ? await this.ctx.model.Task.findAll({ where: { id: taskIds } })
      : [];
    const taskById = new Map(tasks.map(row => [ row.id, row ]));
    const shotIds = [ ...new Set(tasks.map(row => row.shot_id).filter(Boolean)) ];
    const shots = shotIds.length
      ? await this.ctx.model.Shot.findAll({ where: { id: shotIds } })
      : [];
    const shotById = new Map(shots.map(row => [ row.id, row ]));
    const importIds = [ ...new Set(shots.map(row => row.import_id).filter(Boolean)) ];
    const imports = importIds.length
      ? await this.ctx.model.Import.findAll({
        where: { id: importIds },
        attributes: [ 'id', 'chapter_title', 'deleted_at' ],
      })
      : [];
    const importById = new Map(imports.map(row => [ row.id, row ]));
    const editJobIds = [ ...new Set(rows.map(row => row.edit_job_id).filter(Boolean)) ];
    const editJobs = editJobIds.length
      ? await this.ctx.model.EditJob.findAll({ where: { id: editJobIds } })
      : [];
    const editIds = [ ...new Set(editJobs.map(row => row.edit_id).filter(Boolean)) ];
    const edits = editIds.length
      ? await this.ctx.model.Edit.findAll({ where: { id: editIds } })
      : [];
    const editById = new Map(edits.map(row => [ row.id, row ]));
    const editJobById = new Map(editJobs.map(row => [ row.id, row ]));
    const projectIds = [
      ...tasks.map(row => row.project_id),
      ...edits.map(row => row.project_id),
    ].filter(Boolean);
    const projects = await this.names([ ...new Set(projectIds) ]);
    return { taskById, shotById, importById, editById, editJobById, projects };
  }

  locateOutput(output, context) {
    const task = output.task_id ? context.taskById.get(output.task_id) : null;
    const shot = task?.shot_id ? context.shotById.get(task.shot_id) : null;
    let projectId = task?.project_id || null;
    if (!projectId && output.edit_job_id) {
      const job = context.editJobById.get(output.edit_job_id);
      projectId = job ? context.editById.get(job.edit_id)?.project_id : null;
    }
    const project = projectId ? context.projects.get(projectId) : null;
    const snapshot = shot?.import_id ? context.importById.get(shot.import_id) : null;
    return { task, shot, project, snapshot };
  }

  async outputs() {
    const rows = await this.ctx.model.Output.findAll({ order: [[ 'id', 'DESC' ]] });
    const context = await this.outputContext(rows);
    return rows.map(row => {
      const found = this.locateOutput(row, context);
      return this.presentOutput(row, found.task, found.shot, found.project, found.snapshot);
    });
  }

  async output(id) {
    const row = await this.ctx.model.Output.findByPk(id);
    if (!row) this.ctx.throw(404, '产物不存在');
    const context = await this.outputContext([ row ]);
    const found = this.locateOutput(row, context);
    return this.presentOutput(row, found.task, found.shot, found.project, found.snapshot);
  }
}

module.exports = LibraryService;
