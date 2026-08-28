'use strict';

const Service = require('egg').Service;

const ENUM_ORDER = [['sort_order', 'ASC'], ['id', 'ASC']];

class NovelEnumService extends Service {
  async tree() {
    const { GenreCategory, GenreSubcategory, ThemeCategory, AudienceCategory, LengthCategory, UpdatePace } = this.ctx.model;

    const [categories, themes, audiences, lengths, paces] = await Promise.all([
      GenreCategory.findAll({
        include: [{ model: GenreSubcategory, as: 'children', separate: true, order: ENUM_ORDER }],
        order: ENUM_ORDER,
      }),
      ThemeCategory.findAll({ order: [['heat_level', 'DESC'], ['sort_order', 'ASC'], ['id', 'ASC']] }),
      AudienceCategory.findAll({ order: ENUM_ORDER }),
      LengthCategory.findAll({ order: ENUM_ORDER }),
      UpdatePace.findAll({ order: ENUM_ORDER }),
    ]);

    return {
      genres: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        children: (cat.children || []).map((child) => ({
          id: child.id,
          parent_id: child.parent_id,
          name: child.name,
          description: child.description,
        })),
      })),
      themes: themes.map((item) => ({
        id: item.id,
        name: item.name,
        heat_level: item.heat_level,
      })),
      audiences: audiences.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
      })),
      lengths: lengths.map((item) => ({
        id: item.id,
        name: item.name,
        min_words: item.min_words,
        max_words: item.max_words,
        description: item.description,
      })),
      update_paces: paces.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
      })),
    };
  }
}

module.exports = NovelEnumService;
