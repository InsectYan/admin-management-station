'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, JSONB } = app.Sequelize;
  return app.model.define('cartoon_import', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    source_novel_id: { type: STRING(64), allowNull: true },
    chapter_title: { type: STRING(200), allowNull: true },
    body: { type: TEXT, allowNull: false },
    characters: { type: JSONB, allowNull: false, defaultValue: [] },
  }, { tableName: 'cartoon_imports' });
};
