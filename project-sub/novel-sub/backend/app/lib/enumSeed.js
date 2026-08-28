'use strict';

const {
  GENRE_CATEGORIES,
  themeEntries,
  AUDIENCES,
  LENGTHS,
  UPDATE_PACES,
} = require('./enumCatalog');

async function upsertByName(Model, rows) {
  for (const row of rows) {
    const existing = await Model.findOne({ where: { name: row.name } });
    if (existing) {
      await existing.update(row);
    } else {
      await Model.create(row);
    }
  }
}

async function seedNovelEnums(app) {
  const {
    GenreCategory,
    GenreSubcategory,
    ThemeCategory,
    AudienceCategory,
    LengthCategory,
    UpdatePace,
  } = app.model;

  await upsertByName(LengthCategory, LENGTHS.map((item, sort_order) => ({ ...item, sort_order })));
  await upsertByName(AudienceCategory, AUDIENCES.map((name, sort_order) => ({
    name,
    description: name.replace(/-/g, ' / '),
    sort_order,
  })));
  await upsertByName(UpdatePace, UPDATE_PACES.map((item, sort_order) => ({ ...item, sort_order })));
  await upsertByName(ThemeCategory, themeEntries());

  for (const [index, cat] of GENRE_CATEGORIES.entries()) {
    let parent = await GenreCategory.findOne({ where: { name: cat.name } });
    if (parent) {
      await parent.update({ description: cat.description, sort_order: index });
    } else {
      parent = await GenreCategory.create({
        name: cat.name,
        description: cat.description,
        sort_order: index,
      });
    }
    for (const [childIndex, childName] of cat.children.entries()) {
      const existing = await GenreSubcategory.findOne({
        where: { parent_id: parent.id, name: childName },
      });
      if (existing) {
        await existing.update({ sort_order: childIndex });
      } else {
        await GenreSubcategory.create({
          parent_id: parent.id,
          name: childName,
          sort_order: childIndex,
        });
      }
    }
  }

  app.logger.info('[SchemaSync] novel enums seeded');
}

module.exports = { seedNovelEnums };
