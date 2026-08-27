'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

class NovelService extends Service {
  buildWhere(query = {}) {
    const where = {};
    if (query.title) {
      where.title = { [Op.iLike]: `%${query.title}%` };
    }
    if (query.genre) where.genre = query.genre;
    if (query.novel_type) where.novel_type = query.novel_type;
    if (query.progress_status) where.progress_status = query.progress_status;
    if (query.status) where.status = query.status;
    return where;
  }

  buildOrder(query = {}) {
    const field = query.sortField || 'updated_at';
    const allowed = ['title', 'genre', 'novel_type', 'progress_status', 'created_at', 'updated_at'];
    const sortField = allowed.includes(field) ? field : 'updated_at';
    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    return [[sortField, sortOrder]];
  }

  async list(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const { rows, count } = await this.ctx.model.Novel.findAndCountAll({
      where: this.buildWhere(query),
      order: this.buildOrder(query),
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });
    return { list: rows, total: count, page, pageSize };
  }

  async findById(id) {
    return this.ctx.model.Novel.findByPk(id);
  }

  async create(payload) {
    return this.ctx.model.Novel.create(payload);
  }

  async update(id, payload) {
    const row = await this.findById(id);
    if (!row) return null;
    await row.update(payload);
    return row;
  }

  async remove(id) {
    const row = await this.findById(id);
    if (!row) return false;
    await row.destroy();
    return true;
  }

  async batchRemove(ids) {
    const numericIds = (ids || []).map(Number).filter(Boolean);
    if (!numericIds.length) return 0;
    return this.ctx.model.Novel.destroy({
      where: { id: { [Op.in]: numericIds } },
    });
  }

  mergeSettingJson(current, patch) {
    const base = current && typeof current === 'object' ? current : {};
    const next = { ...base };
    for (const key of Object.keys(patch || {})) {
      const val = patch[key];
      if (val && typeof val === 'object' && !Array.isArray(val) && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        next[key] = { ...base[key], ...val };
      } else {
        next[key] = val;
      }
    }
    return next;
  }

  async getSetting(id) {
    const row = await this.findById(id);
    if (!row) return null;
    return row.setting_json || {};
  }

  async updateSetting(id, patch) {
    const row = await this.findById(id);
    if (!row) return null;
    const next = this.mergeSettingJson(row.setting_json, patch);
    await row.update({ setting_json: next });
    return next;
  }
}

module.exports = NovelService;
