'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;

  const GenreSubcategory = app.model.define('genre_subcategory', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    parent_id: { type: INTEGER, allowNull: false },
    name: { type: STRING(50), allowNull: false },
    description: { type: TEXT, allowNull: true },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'genre_subcategories',
    underscored: true,
  });

  GenreSubcategory.associate = function associate() {
    app.model.GenreSubcategory.belongsTo(app.model.GenreCategory, {
      foreignKey: 'parent_id',
      as: 'parent',
    });
  };

  return GenreSubcategory;
};
