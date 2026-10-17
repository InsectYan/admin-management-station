'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, JSONB } = app.Sequelize;
  return app.model.define('cartoon_edit_job', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    edit_id: { type: INTEGER, allowNull: false },
    status: { type: STRING(32), allowNull: false, defaultValue: 'queued' },
    progress: { type: INTEGER, allowNull: false, defaultValue: 0 },
    error_message: { type: TEXT, allowNull: true },
    output_id: { type: INTEGER, allowNull: true },
    args_snapshot: { type: JSONB, allowNull: true },
  }, { tableName: 'cartoon_edit_jobs' });
};
