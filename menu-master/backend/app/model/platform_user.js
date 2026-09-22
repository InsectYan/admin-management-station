'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;

  const PlatformUser = app.model.define(
    'platform_user',
    {
      id: {
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: STRING(64),
        allowNull: false,
        unique: true,
      },
      email: {
        type: STRING(200),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: STRING(200),
        allowNull: false,
      },
      status: {
        type: STRING(20),
        allowNull: false,
        defaultValue: 'pending',
      },
      role: {
        type: STRING(20),
        allowNull: false,
        defaultValue: 'operator',
      },
      mfa_secret: {
        type: STRING(64),
        allowNull: true,
      },
      mfa_enabled: {
        type: app.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      github_login: {
        type: STRING(128),
        allowNull: true,
      },
      github_token: {
        type: app.Sequelize.TEXT,
        allowNull: true,
      },
      aliyun_account_id: {
        type: STRING(64),
        allowNull: true,
      },
      aliyun_access_key_id: {
        type: STRING(128),
        allowNull: true,
      },
      aliyun_access_key_secret: {
        type: app.Sequelize.TEXT,
        allowNull: true,
      },
      created_at: DATE,
      updated_at: DATE,
    },
    {
      tableName: 'platform_users',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return PlatformUser;
};
