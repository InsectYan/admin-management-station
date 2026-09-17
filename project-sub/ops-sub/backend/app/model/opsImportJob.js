'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, DATE } = app.Sequelize;

  const OpsImportJob = app.model.define('ops_import_job', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    status: { type: STRING(24), allowNull: false, defaultValue: 'queued' },
    phase: { type: STRING(32), allowNull: true },
    error: { type: TEXT, allowNull: true },
    result_project_id: { type: INTEGER, allowNull: true },
    result_name: { type: STRING(200), allowNull: true },
    triggered_by: { type: STRING(128), allowNull: true },
    finished_at: { type: DATE, allowNull: true },
  }, {
    tableName: 'ops_import_jobs',
    underscored: true,
  });

  return OpsImportJob;
};
