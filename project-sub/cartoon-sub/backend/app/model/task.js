'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, JSONB } = app.Sequelize;
  return app.model.define('cartoon_task', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    shot_id: { type: INTEGER, allowNull: true },
    kind: { type: STRING(32), allowNull: false, defaultValue: 'image' },
    status: { type: STRING(32), allowNull: false, defaultValue: 'pending' },
    prompt_id: { type: STRING(64), allowNull: true },
    error_message: { type: TEXT, allowNull: true },
    workflow_snapshot: { type: JSONB, allowNull: true },
    precheck_workflow_id: { type: INTEGER, allowNull: true },
    precheck_gap: { type: JSONB, allowNull: true },
    model_profile: { type: STRING(64), allowNull: false, defaultValue: '' },
    package_version: { type: INTEGER, allowNull: true },
    node_name: { type: STRING(64), allowNull: false, defaultValue: '' },
    operator_name: { type: STRING(128), allowNull: false, defaultValue: '' },
  }, { tableName: 'cartoon_tasks' });
};
