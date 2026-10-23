'use strict';

const Service = require('egg').Service;

const STATUS_GROUPS = {
  queued: [ 'pending', 'queued' ],
  running: [ 'running', 'saving' ],
  success: [ 'success' ],
  failed: [ 'failed' ],
  cancelled: [ 'cancelled' ],
};

function ageSeconds(from, to = new Date()) {
  if (!from) return null;
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
}

class OpsInternalService extends Service {
  projectWhere(query) {
    const projectId = Number(query.project_id);
    if (!projectId) return {};
    return { project_id: projectId };
  }

  async nameMap(projectIds) {
    const ids = [ ...new Set(projectIds.filter(Boolean)) ];
    if (!ids.length) return new Map();
    const rows = await this.ctx.model.Project.findAll({
      where: { id: ids },
      attributes: [ 'id', 'name' ],
    });
    return new Map(rows.map(row => [ row.id, row.name ]));
  }

  toTask(row, names) {
    const status = row.status;
    const waiting = status === 'pending' || status === 'queued';
    return {
      id: row.id,
      project_id: row.project_id,
      project_name: names.get(row.project_id) || '',
      shot_id: row.shot_id,
      kind: row.kind,
      status,
      prompt_id: row.prompt_id,
      error_message: row.error_message || '',
      precheck_workflow_id: row.precheck_workflow_id || null,
      precheck_gap: row.precheck_gap || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      queue_seconds: waiting ? ageSeconds(row.created_at) : ageSeconds(row.created_at, row.updated_at),
    };
  }

  async tasks(query) {
    const { Op } = this.app.Sequelize;
    const where = this.projectWhere(query);
    const group = STATUS_GROUPS[query.status];
    if (group) where.status = { [Op.in]: group };
    else if (query.status) where.status = String(query.status);

    if (query.stuck === '1') {
      const minutes = Math.max(1, Number(query.stuck_minutes) || 30);
      const before = new Date(Date.now() - minutes * 60 * 1000);
      where.status = { [Op.in]: STATUS_GROUPS.running };
      where.updated_at = { [Op.lt]: before };
    }

    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = Math.max(0, Number(query.offset) || 0);
    const { rows, count } = await this.ctx.model.Task.findAndCountAll({
      where,
      order: [[ 'created_at', 'DESC' ]],
      limit,
      offset,
    });
    const names = await this.nameMap(rows.map(row => row.project_id));
    return {
      list: rows.map(row => this.toTask(row, names)),
      total: count,
      limit,
      offset,
    };
  }

  async show(id) {
    const task = await this.ctx.model.Task.findByPk(id);
    if (!task) this.ctx.throw(404, '任务不存在');
    const names = await this.nameMap([ task.project_id ]);
    const shot = task.shot_id ? await this.ctx.model.Shot.findByPk(task.shot_id) : null;
    const prompt = task.shot_id
      ? await this.ctx.model.Prompt.findOne({ where: { shot_id: task.shot_id } })
      : null;
    const outputs = await this.ctx.model.Output.findAll({
      where: { task_id: task.id },
      order: [[ 'id', 'ASC' ]],
    });
    return {
      ...this.toTask(task, names),
      workflow_snapshot: task.workflow_snapshot || null,
      shot: shot ? {
        id: shot.id,
        description: shot.description || '',
        shot_size: shot.shot_size || '',
        camera_move: shot.camera_move || '',
      } : null,
      prompt: prompt ? {
        positive_zh: prompt.positive_zh || '',
        negative_zh: prompt.negative_zh || '',
      } : null,
      outputs: outputs.map(item => ({
        id: item.id,
        file_path: item.file_path,
        media_kind: item.media_kind,
      })),
    };
  }

  async retry(id) {
    await this.ctx.service.generate.rerun(id);
    return this.show(id);
  }

  async cancel(id) {
    const task = await this.ctx.model.Task.findByPk(id);
    if (!task) this.ctx.throw(404, '任务不存在');
    if (![ 'pending', 'queued', 'running' ].includes(task.status)) {
      this.ctx.throw(400, '只有待处理或处理中的任务可以取消');
    }
    await task.update({
      status: 'cancelled',
      error_message: task.error_message || '运维取消',
    });
    return this.show(id);
  }

  async projects() {
    const rows = await this.ctx.model.Project.findAll({
      attributes: [ 'id', 'name', 'status', 'content_type', 'package_version' ],
      order: [[ 'id', 'DESC' ]],
    });
    const tasks = await this.ctx.model.VideoTask.findAll({
      attributes: [ 'project_id', 'current_node', 'episode_no' ],
      order: [[ 'episode_no', 'ASC' ]],
    });
    const nodeByProject = new Map();
    for (const task of tasks) {
      if (!nodeByProject.has(task.project_id)) nodeByProject.set(task.project_id, task.current_node);
    }
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      content_type: row.content_type,
      package_version: row.package_version,
      current_node: nodeByProject.get(row.id) || '',
    }));
  }

  async summary(query) {
    const { Op } = this.app.Sequelize;
    const where = this.projectWhere(query);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const stuckMinutes = Math.max(1, Number(query.stuck_minutes) || 30);
    const stuckBefore = new Date(Date.now() - stuckMinutes * 60 * 1000);

    const [ todayRows, hourRows, backlog, running, stuckRows, recent ] = await Promise.all([
      this.ctx.model.Task.findAll({
        where: { ...where, created_at: { [Op.gte]: start } },
        attributes: [ 'status', 'created_at', 'updated_at' ],
      }),
      this.ctx.model.Task.findAll({
        where: {
          ...where,
          updated_at: { [Op.gte]: hourAgo },
          status: { [Op.in]: [ 'success', 'failed' ] },
        },
        attributes: [ 'status' ],
      }),
      this.ctx.model.Task.count({
        where: { ...where, status: { [Op.in]: STATUS_GROUPS.queued } },
      }),
      this.ctx.model.Task.count({
        where: { ...where, status: { [Op.in]: STATUS_GROUPS.running } },
      }),
      this.ctx.model.Task.findAll({
        where: {
          ...where,
          status: { [Op.in]: STATUS_GROUPS.running },
          updated_at: { [Op.lt]: stuckBefore },
        },
        order: [[ 'updated_at', 'ASC' ]],
        limit: 50,
      }),
      this.ctx.model.Task.findAll({
        where: { ...where, status: 'failed' },
        order: [[ 'updated_at', 'DESC' ]],
        limit: 10,
      }),
    ]);

    const todaySuccess = todayRows.filter(row => row.status === 'success');
    const durations = todaySuccess
      .map(row => ageSeconds(row.created_at, row.updated_at))
      .filter(value => value != null);
    const names = await this.nameMap([
      ...stuckRows.map(row => row.project_id),
      ...recent.map(row => row.project_id),
    ]);

    return {
      today_total: todayRows.length,
      today_success: todaySuccess.length,
      today_failed: todayRows.filter(row => row.status === 'failed').length,
      avg_duration_sec: durations.length
        ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
        : null,
      backlog,
      running,
      hour_success: hourRows.filter(row => row.status === 'success').length,
      hour_failed: hourRows.filter(row => row.status === 'failed').length,
      stuck: stuckRows.map(row => this.toTask(row, names)),
      recent_failures: recent.map(row => this.toTask(row, names)),
    };
  }
}

module.exports = OpsInternalService;
