'use strict';

module.exports = (app) => {
  const { STRING, INTEGER, TEXT, SMALLINT, JSONB } = app.Sequelize;

  const Novel = app.model.define('novel', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: STRING(200), allowNull: false },
    cover_url: { type: STRING(500), allowNull: true },
    genre: { type: STRING(50), allowNull: true },
    novel_type: { type: STRING(50), allowNull: true },
    progress_status: { type: STRING(20), defaultValue: 'ongoing' },
    progress_percent: { type: SMALLINT, defaultValue: 0 },
    summary: { type: TEXT, allowNull: true },
    creative_intent: { type: TEXT, allowNull: true },
    target_audience: { type: STRING(200), allowNull: true },
    update_cadence: { type: STRING(50), allowNull: true },
    setting_json: { type: JSONB, defaultValue: {} },
    author_name: { type: STRING(100), allowNull: true },
    status: { type: STRING(20), defaultValue: 'draft' },
  }, {
    tableName: 'novels',
    underscored: true,
  });

  return Novel;
};
