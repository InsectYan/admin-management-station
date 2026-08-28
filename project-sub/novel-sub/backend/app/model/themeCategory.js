'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT, SMALLINT } = app.Sequelize;

  const ThemeCategory = app.model.define('theme_category', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(50), allowNull: false, unique: true },
    description: { type: TEXT, allowNull: true },
    heat_level: { type: SMALLINT, allowNull: false, defaultValue: 1 },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'theme_categories',
    underscored: true,
  });

  ThemeCategory.associate = function associate() {
    app.model.ThemeCategory.belongsToMany(app.model.Novel, {
      through: app.model.NovelTheme,
      foreignKey: 'theme_id',
      otherKey: 'novel_id',
      as: 'novels',
    });
  };

  return ThemeCategory;
};
