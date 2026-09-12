'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, JSONB } = app.Sequelize;

  const OpsProject = app.model.define('ops_project', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(200), allowNull: false },
    project_type: { type: STRING(32), allowNull: false, defaultValue: 'frontend' },
    description: { type: TEXT, allowNull: true },
    repo_url: { type: STRING(500), allowNull: true },
    status: { type: STRING(32), allowNull: false, defaultValue: 'draft' },
    directory_tree: { type: JSONB, allowNull: false, defaultValue: [] },
    routes: { type: JSONB, allowNull: false, defaultValue: [] },
    flows: { type: JSONB, allowNull: false, defaultValue: [] },
    extra_json: { type: JSONB, allowNull: false, defaultValue: {} },
  }, {
    tableName: 'ops_projects',
    underscored: true,
  });

  return OpsProject;
};
