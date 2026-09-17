'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, JSONB, DATE } = app.Sequelize;

  const OpsDeployJob = app.model.define('ops_deploy_job', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    status: { type: STRING(24), allowNull: false, defaultValue: 'queued' },
    git_remote: { type: STRING(500), allowNull: true },
    git_tag: { type: STRING(128), allowNull: false },
    git_sha: { type: STRING(64), allowNull: true },
    params: { type: JSONB, allowNull: false, defaultValue: {} },
    triggered_by: { type: STRING(128), allowNull: false },
    parent_job_id: { type: INTEGER, allowNull: true },
    retry_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    agent_session_id: { type: STRING(128), allowNull: true },
    error_summary: { type: TEXT, allowNull: true },
    started_at: { type: DATE, allowNull: true },
    finished_at: { type: DATE, allowNull: true },
  }, {
    tableName: 'ops_deploy_jobs',
    underscored: true,
    indexes: [
      { fields: [ 'project_id', 'created_at' ] },
      { fields: [ 'status' ] },
      { fields: [ 'triggered_by' ] },
    ],
  });

  OpsDeployJob.associate = () => {
    app.model.OpsDeployJob.belongsTo(app.model.OpsProject, {
      foreignKey: 'project_id',
      as: 'project',
    });
    app.model.OpsDeployJob.hasMany(app.model.OpsDeployLogLine, {
      foreignKey: 'job_id',
      as: 'logs',
    });
  };

  return OpsDeployJob;
};
