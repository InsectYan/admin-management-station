'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, SMALLINT } = app.Sequelize;
  return app.model.define('project_env_template', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_code: { type: STRING(64), allowNull: false },
    name: { type: STRING(128), allowNull: false },
    tier: { type: STRING(32), allowNull: false, defaultValue: 'staging' },
    base_url: { type: STRING(512) },
    base_path: { type: STRING(256), defaultValue: '/' },
    auth_type: { type: STRING(32), defaultValue: 'none' },
    auth_secret: { type: TEXT },
    db_host: { type: STRING(256) },
    db_port: { type: STRING(16), defaultValue: '5432' },
    db_name: { type: STRING(128) },
    db_user: { type: STRING(128) },
    db_password: { type: TEXT },
    sort_order: { type: SMALLINT, defaultValue: 0 },
  }, { tableName: 'project_env_template' });
};
