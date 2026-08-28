'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;

  const GenreCategory = app.model.define('genre_category', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(50), allowNull: false, unique: true },
    description: { type: TEXT, allowNull: true },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'genre_categories',
    underscored: true,
  });

  GenreCategory.associate = function associate() {
    app.model.GenreCategory.hasMany(app.model.GenreSubcategory, {
      foreignKey: 'parent_id',
      as: 'children',
    });
  };

  return GenreCategory;
};
