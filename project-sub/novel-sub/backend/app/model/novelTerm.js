'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, JSONB, TEXT } = app.Sequelize;
  return app.model.define('novel_term', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    name: { type: STRING(100), allowNull: false },
    aliases: { type: JSONB, allowNull: false, defaultValue: [] },
    definition: { type: TEXT, allowNull: true },
    category: { type: STRING(32), allowNull: false, defaultValue: 'term' },
    status: { type: STRING(20), allowNull: false, defaultValue: 'active' },
  }, {
    tableName: 'novel_terms',
    underscored: true,
  });
};
