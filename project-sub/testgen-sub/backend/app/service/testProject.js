'use strict';

const { Op } = require('sequelize');

class TestProjectService extends require('egg').Service {
  buildWhere(query) {
    const where = {};
    if (query.team) where.team = query.team;
    if (query.status) where.status = query.status;
    if (query.keyword) {
      where[Op.or] = [
        { project_code: { [Op.iLike]: `%${query.keyword}%` } },
        { project_name: { [Op.iLike]: `%${query.keyword}%` } },
      ];
    }
    if (query.activeWithinDays) {
      const days = Number(query.activeWithinDays);
      if (days > 0) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        where.last_active_at = { [Op.gte]: since };
      }
    }
    return where;
  }

  async list() {
    const { page = 1, pageSize = 20, sort = 'last_active_at' } = this.ctx.query;
    const orderField = [ 'last_active_at', 'created_at', 'project_name', 'project_code' ].includes(sort)
      ? sort
      : 'last_active_at';
    const { count, rows } = await this.ctx.model.TestProject.findAndCountAll({
      where: this.buildWhere(this.ctx.query),
      order: [[ orderField, 'DESC' ]],
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
    });
    return { list: rows, total: count, page: Number(page), pageSize: Number(pageSize) };
  }

  async findByCode(projectCode) {
    return this.ctx.model.TestProject.findByPk(projectCode);
  }

  async create(payload) {
    const { project_code, project_name } = payload;
    if (!project_code || !project_name) {
      const err = new Error('project_code 与 project_name 为必填项');
      err.status = 400;
      throw err;
    }
    const exists = await this.ctx.model.TestProject.findByPk(project_code);
    if (exists) {
      const err = new Error('项目编码已存在');
      err.status = 409;
      throw err;
    }
    const now = new Date();
    const project = await this.ctx.model.TestProject.create({
      ...payload,
      project_code: String(project_code).trim(),
      project_name: String(project_name).trim(),
      last_active_at: now,
    });
    return project;
  }

  async update(projectCode, payload) {
    const project = await this.ctx.model.TestProject.findByPk(projectCode);
    if (!project) return null;
    const { project_code: _pc, ...rest } = payload;
    await project.update({ ...rest, last_active_at: new Date() });
    return project;
  }

  async destroy(projectCode) {
    const project = await this.ctx.model.TestProject.findByPk(projectCode);
    if (!project) return false;
    await project.destroy();
    return true;
  }

  async stats(projectCode) {
    const project = await this.findByCode(projectCode);
    if (!project) return null;
    const [ itemRows, planRows ] = await Promise.all([
      this.app.model.query(
        'SELECT COUNT(*)::int AS cnt FROM test_item_detail WHERE project_code = :code',
        { replacements: { code: projectCode }, type: this.app.Sequelize.QueryTypes.SELECT },
      ),
      this.app.model.query(
        'SELECT COUNT(*)::int AS cnt FROM test_plan',
        { type: this.app.Sequelize.QueryTypes.SELECT },
      ),
    ]);
    return {
      test_item_count: itemRows[0]?.cnt ?? 0,
      test_plan_count: planRows[0]?.cnt ?? 0,
    };
  }
}

module.exports = TestProjectService;
