'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;

  const SubappRegistry = app.model.define(
    'subapp_registry',
    {
      id: {
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      microapp_name: {
        type: STRING(50),
        allowNull: false,
        unique: true,
      },
      app_key: {
        type: STRING(50),
        allowNull: false,
      },
      display_name: {
        type: STRING(100),
        allowNull: true,
      },
      entry_dev: {
        type: STRING(200),
        allowNull: false,
      },
      entry_prod: {
        type: STRING(200),
        allowNull: true,
      },
      vite_port: {
        type: INTEGER,
        allowNull: true,
      },
      api_port: {
        type: INTEGER,
        allowNull: true,
      },
      agent_port: {
        type: INTEGER,
        allowNull: true,
      },
      status: {
        type: STRING(20),
        defaultValue: 'enabled',
      },
      created_at: DATE,
      updated_at: DATE,
    },
    {
      tableName: 'subapp_registry',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return SubappRegistry;
};
