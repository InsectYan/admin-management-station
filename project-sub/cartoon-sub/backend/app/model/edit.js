'use strict';

module.exports = app => {
  const { STRING, INTEGER } = app.Sequelize;
  return app.model.define('cartoon_edit', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false, unique: true },
    title: { type: STRING(200), allowNull: false, defaultValue: '' },
    width: { type: INTEGER, allowNull: false, defaultValue: 720 },
    height: { type: INTEGER, allowNull: false, defaultValue: 1280 },
    fps: { type: INTEGER, allowNull: false, defaultValue: 24 },
    duration_ms: { type: INTEGER, allowNull: false, defaultValue: 0 },
    status: { type: STRING(32), allowNull: false, defaultValue: 'draft' },
  }, { tableName: 'cartoon_edits' });
};
