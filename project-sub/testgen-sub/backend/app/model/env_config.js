'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, JSONB } = app.Sequelize;

  const EnvConfig = app.model.define(
    'env_config',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: STRING(255), allowNull: false },
      description: { type: TEXT },
      base_url: { type: STRING(1024), allowNull: false },
      headers_template: { type: JSONB, defaultValue: {} },
      variables: { type: JSONB, defaultValue: {} },
    },
    { tableName: 'env_configs' },
  );

  return EnvConfig;
};
