'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, SMALLINT } = app.Sequelize;
  return app.model.define('project_env_variable', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_code: { type: STRING(64), allowNull: false },
    var_key: { type: STRING(128), allowNull: false },
    var_value: { type: TEXT },
    source: { type: STRING(32), allowNull: false, defaultValue: 'manual' },
    extract_path: { type: TEXT },
    from_step: { type: STRING(128) },
    sort_order: { type: SMALLINT, defaultValue: 0 },
  }, { tableName: 'project_env_variable' });
};
