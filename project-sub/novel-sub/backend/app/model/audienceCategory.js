'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;

  const AudienceCategory = app.model.define('audience_category', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(50), allowNull: false, unique: true },
    description: { type: TEXT, allowNull: true },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'audience_categories',
    underscored: true,
  });

  return AudienceCategory;
};
