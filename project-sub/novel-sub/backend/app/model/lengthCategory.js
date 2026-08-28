'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;

  const LengthCategory = app.model.define('length_category', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(20), allowNull: false, unique: true },
    min_words: { type: INTEGER, allowNull: false, defaultValue: 0 },
    max_words: { type: INTEGER, allowNull: false, defaultValue: 0 },
    description: { type: TEXT, allowNull: true },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'length_categories',
    underscored: true,
  });

  return LengthCategory;
};
