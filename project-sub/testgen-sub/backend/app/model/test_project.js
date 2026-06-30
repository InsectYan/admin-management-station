'use strict';

module.exports = app => {
  const { STRING, TEXT, DATE } = app.Sequelize;
  const TestProject = app.model.define('test_project', {
    project_code: { type: STRING(64), primaryKey: true },
    project_name: { type: STRING(255), allowNull: false },
    team: { type: STRING(128) },
    status: { type: STRING(32), allowNull: false, defaultValue: 'active' },
    description: { type: TEXT },
    repo_urls: { type: app.Sequelize.JSONB, defaultValue: [] },
    cicd_config: { type: app.Sequelize.JSONB, defaultValue: {} },
    member_roles: { type: app.Sequelize.JSONB, defaultValue: [] },
    last_active_at: { type: DATE },
  }, {
    tableName: 'test_project',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
  return TestProject;
};
