'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

class NovelService extends Service {
  async list({ title, status, page = 1, pageSize = 20 }) {
    const where = {};
    if (title) where.title = { [Op.iLike]: `%${title}%` };
    if (status) where.status = status;

    const offset = (page - 1) * pageSize;
    const { count, rows } = await this.ctx.model.Novel.findAndCountAll({
      where,
      limit: pageSize,
      offset,
      order: [['updated_at', 'DESC']],
    });

    return {
      list: rows.map(r => r.toJSON()),
      total: count,
      page,
      pageSize,
    };
  }

  async findById(id) {
    const row = await this.ctx.model.Novel.findByPk(id);
    return row ? row.toJSON() : null;
  }

  async create(payload) {
    const row = await this.ctx.model.Novel.create({
      title: payload.title || '未命名小说',
      author_name: payload.author_name || payload.author || '',
      status: payload.status || 'draft',
      progress: payload.progress || 0,
      word_count: payload.word_count || 0,
      plot: payload.plot || null,
      draft: payload.draft || null,
    });
    return row.toJSON();
  }

  async update(id, payload) {
    const row = await this.ctx.model.Novel.findByPk(id);
    if (!row) return null;
    await row.update({
      title: payload.title ?? row.title,
      author_name: payload.author_name ?? payload.author ?? row.author_name,
      status: payload.status ?? row.status,
      progress: payload.progress ?? row.progress,
      word_count: payload.word_count ?? row.word_count,
      plot: payload.plot ?? row.plot,
      draft: payload.draft ?? row.draft,
    });
    return row.toJSON();
  }

  async destroy(id) {
    const row = await this.ctx.model.Novel.findByPk(id);
    if (!row) return false;
    await row.destroy();
    return true;
  }
}

module.exports = NovelService;
