'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');
const { formatDateTime } = require('../lib/formatDateTime');
const {
  inspectNovel,
  normalizeChapterOrder,
  relinkOutline,
} = require('../lib/novelInspect');

class NovelAnomalyService extends Service {
  serialize(row) {
    if (!row) return null;
    const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    return {
      id: json.id,
      novel_id: json.novel_id,
      novel_title: json.novel?.title || '',
      mode: json.mode,
      status: json.status,
      summary: json.summary || '',
      issue_count: Number(json.issue_count) || 0,
      word_floor: Number(json.word_floor) || 0,
      findings: Array.isArray(json.findings_json) ? json.findings_json : [],
      tasks: Array.isArray(json.tasks_json) ? json.tasks_json : [],
      created_at: formatDateTime(json.created_at),
      updated_at: formatDateTime(json.updated_at),
    };
  }

  async list({ page = 1, pageSize = 20, title = '' } = {}) {
    const current = Math.max(Number(page) || 1, 1);
    const size = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
    const include = [{
      association: 'novel',
      attributes: ['id', 'title'],
      required: Boolean(title),
      where: title ? { title: { [Op.iLike]: `%${title}%` } } : undefined,
    }];
    const { rows, count } = await this.ctx.model.NovelAnomalyReport.findAndCountAll({
      include,
      order: [['created_at', 'DESC']],
      offset: (current - 1) * size,
      limit: size,
      distinct: true,
    });
    return {
      list: rows.map((row) => this.serialize(row)),
      total: count,
      page: current,
      pageSize: size,
    };
  }

  async findById(id) {
    const row = await this.ctx.model.NovelAnomalyReport.findByPk(id, {
      include: [{ association: 'novel', attributes: ['id', 'title'] }],
    });
    return this.serialize(row);
  }

  async createReport(novelId, mode) {
    const novel = await this.ctx.model.Novel.findByPk(novelId);
    if (!novel) return null;
    const bodies = await this.ctx.model.NovelChapterBody.findAll({
      where: { novel_id: novelId },
      attributes: ['chapter_id', 'body', 'word_count'],
    });
    const report = inspectNovel({
      setting: novel.setting_json || {},
      bodies,
      mode,
    });
    const row = await this.ctx.model.NovelAnomalyReport.create({
      novel_id: novel.id,
      mode: report.mode,
      status: report.issue_count ? 'open' : 'done',
      summary: report.summary,
      issue_count: report.issue_count,
      word_floor: report.word_floor,
      findings_json: report.findings,
      tasks_json: report.tasks,
    });
    return this.findById(row.id);
  }

  async runTask(reportId, taskId) {
    const row = await this.ctx.model.NovelAnomalyReport.findByPk(reportId);
    if (!row) return null;
    const tasks = Array.isArray(row.tasks_json) ? row.tasks_json.map((task) => ({ ...task })) : [];
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      const err = new Error('修正任务不存在');
      err.status = 404;
      throw err;
    }
    if (task.action === 'rewrite_chapter') {
      return {
        report: this.serialize(row),
        needs_client: true,
        task,
      };
    }
    const novel = await this.ctx.model.Novel.findByPk(row.novel_id);
    if (!novel) {
      const err = new Error('小说不存在');
      err.status = 404;
      throw err;
    }
    const setting = novel.setting_json || {};
    const volumes = setting.outline?.volumes || [];
    let chapters = Array.isArray(setting.chapters) ? setting.chapters : [];
    if (task.action === 'normalize_order') {
      chapters = normalizeChapterOrder(chapters, volumes);
    } else if (task.action === 'relink_outline') {
      chapters = relinkOutline(chapters, volumes);
    } else {
      const err = new Error('不支持的修正动作');
      err.status = 400;
      throw err;
    }
    await novel.update({
      setting_json: { ...setting, chapters },
    });
    task.status = 'done';
    task.error = '';
    await this.saveTasks(row, tasks);
    return { report: await this.findById(row.id), needs_client: false, task };
  }

  async setTaskStatus(reportId, taskId, status, error = '') {
    const row = await this.ctx.model.NovelAnomalyReport.findByPk(reportId);
    if (!row) return null;
    const tasks = Array.isArray(row.tasks_json) ? row.tasks_json.map((task) => ({ ...task })) : [];
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      const err = new Error('修正任务不存在');
      err.status = 404;
      throw err;
    }
    task.status = status === 'done' ? 'done' : 'failed';
    task.error = status === 'done' ? '' : String(error || '').slice(0, 300);
    await this.saveTasks(row, tasks);
    return this.findById(row.id);
  }

  async saveTasks(row, tasks) {
    const done = tasks.filter((task) => task.status === 'done').length;
    const failed = tasks.some((task) => task.status === 'failed');
    let status = 'open';
    if (tasks.length && done === tasks.length) status = 'done';
    else if (done > 0 || failed) status = 'fixing';
    row.tasks_json = tasks;
    row.status = status;
    row.changed('tasks_json', true);
    await row.save();
  }
}

module.exports = NovelAnomalyService;
