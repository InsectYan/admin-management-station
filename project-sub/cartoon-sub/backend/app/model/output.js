'use strict';

module.exports = app => {
  const { STRING, INTEGER } = app.Sequelize;
  return app.model.define('cartoon_output', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    task_id: { type: INTEGER, allowNull: true },
    edit_job_id: { type: INTEGER, allowNull: true },
    file_path: { type: STRING(500), allowNull: true },
    media_kind: { type: STRING(32), allowNull: false, defaultValue: 'image' },
    duration_ms: { type: INTEGER, allowNull: true },
    width: { type: INTEGER, allowNull: true },
    height: { type: INTEGER, allowNull: true },
  }, { tableName: 'cartoon_outputs' });
};
