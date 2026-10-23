'use strict';

const Service = require('egg').Service;

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
    const where = kind ? { kind: ASSET_KINDS[kind] } : {};
    const rows = await this.ctx.model.Asset.findAll({ where, order: [[ 'id', 'DESC' ]], limit: 100 });
    const projects = await this.names([ ...new Set(rows.map(row => row.project_id)) ]);
    return rows.map(row => ({
      ...row.toJSON(),
      project_name: projects.get(row.project_id)?.name || '',
    }));
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
    const rows = await this.ctx.model.Project.findAll({ order: [[ 'id', 'DESC' ]] });
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      content_type: row.content_type,
      pin_mode: row.pin_mode,
      package_id: row.package_id,
      package_version: row.package_version,
    }));
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
    return result;
  }
}

module.exports = LibraryService;
