'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, BIGINT, DATE } = app.Sequelize;

  const OpsDeployLogLine = app.model.define('ops_deploy_log_line', {
    id: { type: BIGINT, primaryKey: true, autoIncrement: true },
    job_id: { type: INTEGER, allowNull: false },
    level: { type: STRING(16), allowNull: false, defaultValue: 'info' },
    message: { type: TEXT, allowNull: false },
    created_at: { type: DATE, allowNull: false },
  }, {
    tableName: 'ops_deploy_log_lines',
    underscored: true,
    updatedAt: false,
    indexes: [
      { fields: [ 'job_id', 'id' ] },
    ],
  });

  OpsDeployLogLine.associate = () => {
    app.model.OpsDeployLogLine.belongsTo(app.model.OpsDeployJob, {
      foreignKey: 'job_id',
      as: 'job',
    });
  };

  return OpsDeployLogLine;
};
