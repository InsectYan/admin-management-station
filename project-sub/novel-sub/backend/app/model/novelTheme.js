'use strict';

module.exports = (app) => {
  const { INTEGER } = app.Sequelize;

  const NovelTheme = app.model.define('novel_theme', {
    novel_id: { type: INTEGER, primaryKey: true },
    theme_id: { type: INTEGER, primaryKey: true },
  }, {
    tableName: 'novel_themes',
    underscored: true,
  });

  return NovelTheme;
};
