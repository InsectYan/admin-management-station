'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, JSONB } = app.Sequelize;
  return app.model.define('plotline', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    name: { type: STRING(100), allowNull: false },
    kind: { type: STRING(32), allowNull: false, defaultValue: 'main' },
    status: { type: STRING(20), allowNull: false, defaultValue: 'open' },
    plant_chapter_id: { type: STRING(80), allowNull: false, defaultValue: '' },
    payoff_chapter_id: { type: STRING(80), allowNull: false, defaultValue: '' },
    events: { type: JSONB, allowNull: false, defaultValue: [] },
  }, {
    tableName: 'plotlines',
    underscored: true,
  });
};
