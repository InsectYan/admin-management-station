'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

const NOVEL_INCLUDES = [
  { association: 'genreCategory', attributes: ['id', 'name'] },
  { association: 'genreSubcategory', attributes: ['id', 'name', 'parent_id'] },
  { association: 'lengthCategory', attributes: ['id', 'name'] },
  { association: 'audienceCategory', attributes: ['id', 'name'] },
  { association: 'updatePace', attributes: ['id', 'name'] },
  { association: 'themes', attributes: ['id', 'name', 'heat_level'], through: { attributes: [] } },
];

class NovelService extends Service {
  serialize(row) {
    if (!row) return null;
    const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    const {
      genreCategory,
      genreSubcategory,
      lengthCategory,
      audienceCategory,
      updatePace,
      themes: rawThemes,
      ...rest
    } = json;
    const themes = (rawThemes || []).map((t) => ({ id: t.id, name: t.name, heat_level: t.heat_level }));
    return {
      ...rest,
      genre: genreCategory?.name || rest.genre || null,
      genre_subcategory: genreSubcategory?.name || null,
      novel_type: lengthCategory?.name || rest.novel_type || null,
      target_audience: audienceCategory?.name || rest.target_audience || null,
      update_cadence: updatePace?.name || rest.update_cadence || null,
      theme_ids: themes.map((t) => t.id),
      themes,
    };
  }

  buildWhere(query = {}) {
    const where = {};
    if (query.title) {
      where.title = { [Op.iLike]: `%${query.title}%` };
    }
    if (query.genre) where.genre = query.genre;
    if (query.genre_category_id) where.genre_category_id = Number(query.genre_category_id);
    if (query.novel_type) where.novel_type = query.novel_type;
    if (query.length_id) where.length_id = Number(query.length_id);
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

  async resolveEnumFields(payload = {}) {
    const { GenreCategory, GenreSubcategory, LengthCategory, AudienceCategory, UpdatePace, ThemeCategory } = this.ctx.model;
    const next = { ...payload };

    if (next.genre_category_id) {
      const cat = await GenreCategory.findByPk(next.genre_category_id);
      if (cat) next.genre = cat.name;
    }
    if (next.genre_subcategory_id) {
      const sub = await GenreSubcategory.findByPk(next.genre_subcategory_id);
      if (sub) {
        next.genre_subcategory_id = sub.id;
        if (!next.genre_category_id) next.genre_category_id = sub.parent_id;
      }
    }
    if (next.length_id) {
      const length = await LengthCategory.findByPk(next.length_id);
      if (length) next.novel_type = length.name;
    }
    if (next.audience_id) {
      const audience = await AudienceCategory.findByPk(next.audience_id);
      if (audience) next.target_audience = audience.name;
    } else if (typeof next.target_audience === 'string' && next.target_audience.includes(',')) {
      next.target_audience = next.target_audience.split(',')[0].trim();
    }
    if (next.update_pace_id) {
      const pace = await UpdatePace.findByPk(next.update_pace_id);
      if (pace) next.update_cadence = pace.name;
    }

    let themes = null;
    if (Array.isArray(next.theme_ids)) {
      const ids = next.theme_ids.map(Number).filter(Boolean);
      themes = ids.length ? await ThemeCategory.findAll({ where: { id: { [Op.in]: ids } } }) : [];
    }

    delete next.theme_ids;
    delete next.themes;
    delete next.genre_path;
    delete next.genre_subcategory;
    return { fields: next, themes };
  }

  async list(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const { rows, count } = await this.ctx.model.Novel.findAndCountAll({
      where: this.buildWhere(query),
      include: NOVEL_INCLUDES,
      distinct: true,
      order: this.buildOrder(query),
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });
    return { list: rows.map((row) => this.serialize(row)), total: count, page, pageSize };
  }

  async findById(id) {
    const row = await this.ctx.model.Novel.findByPk(id, { include: NOVEL_INCLUDES });
    return this.serialize(row);
  }

  async create(payload) {
    const { fields, themes } = await this.resolveEnumFields(payload);
    const row = await this.ctx.model.Novel.create(fields);
    if (themes) await row.setThemes(themes);
    return this.findById(row.id);
  }

  async update(id, payload) {
    const row = await this.ctx.model.Novel.findByPk(id);
    if (!row) return null;
    const { fields, themes } = await this.resolveEnumFields(payload);
    await row.update(fields);
    if (themes) await row.setThemes(themes);
    return this.findById(id);
  }

  async remove(id) {
    const row = await this.ctx.model.Novel.findByPk(id);
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
    const row = await this.ctx.model.Novel.findByPk(id);
    if (!row) return null;
    return row.setting_json || {};
  }

  async updateSetting(id, patch) {
    const row = await this.ctx.model.Novel.findByPk(id);
    if (!row) return null;
    const next = this.mergeSettingJson(row.setting_json, patch);
    await row.update({ setting_json: next });
    return next;
  }
}

module.exports = NovelService;
