'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

class KnowledgeService extends Service {
  async search({ module, tag, q, limit = 20, page = 1, pageSize = 20, page_size } = {}) {
    const where = {};
    if (module) where.module = module;
    if (tag) where.tag = tag;
    if (q) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q}%` } },
        { content: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const size = Number(page_size || pageSize);
    const { count, rows } = await this.ctx.model.KnowledgeEntry.findAndCountAll({
      where,
      limit: q ? limit : size,
      offset: q ? 0 : (page - 1) * size,
      order: [[ 'updated_at', 'DESC' ]],
    });

    return {
      list: rows.map(r => r.toJSON()),
      total: count,
      page: Number(page),
      pageSize: size,
    };
  }

  async findById(id) {
    const row = await this.ctx.model.KnowledgeEntry.findByPk(id);
    return row ? row.toJSON() : null;
  }

  async create(payload) {
    const row = await this.ctx.model.KnowledgeEntry.create({
      module: payload.module,
      tag: payload.tag || null,
      title: payload.title || null,
      content: payload.content,
      entity_refs: payload.entity_refs || [],
    });
    return row.toJSON();
  }

  async update(id, payload) {
    const row = await this.ctx.model.KnowledgeEntry.findByPk(id);
    if (!row) return null;
    await row.update({
      module: payload.module ?? row.module,
      tag: payload.tag ?? row.tag,
      title: payload.title ?? row.title,
      content: payload.content ?? row.content,
      entity_refs: payload.entity_refs ?? row.entity_refs,
    });
    return row.toJSON();
  }

  async delete(id) {
    const row = await this.ctx.model.KnowledgeEntry.findByPk(id);
    if (!row) return false;
    await row.destroy();
    return true;
  }
}

module.exports = KnowledgeService;
