'use strict';

module.exports = app => {
  const { INTEGER, STRING, BOOLEAN, JSONB } = app.Sequelize;
  return app.model.define('ft_execution_env', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(128), allowNull: false },
    config_env_id: { type: STRING(64) },
    bff_coach_url: { type: STRING(512) },
    bff_member_url: { type: STRING(512) },
    bff_manager_url: { type: STRING(512) },
    agent_chat_url: { type: STRING(512) },
    cli_workspace_root: { type: STRING(512) },
    auth_configured: { type: JSONB, defaultValue: {} },
    is_default: { type: BOOLEAN, defaultValue: false },
  }, { tableName: 'ft_execution_env' });
};
