'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, DATE } = app.Sequelize;

  const PlatformAuditLog = app.model.define(
    'platform_audit_log',
    {
      id: {
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      actor_id: {
        type: INTEGER,
        allowNull: true,
      },
      actor_username: {
        type: STRING(64),
        allowNull: false,
      },
      action: {
        type: STRING(64),
        allowNull: false,
      },
      target_user_id: {
        type: INTEGER,
        allowNull: true,
      },
      target_username: {
        type: STRING(64),
        allowNull: true,
      },
      detail: {
        type: TEXT,
        allowNull: true,
      },
      created_at: DATE,
    },
    {
      tableName: 'platform_audit_logs',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );

  return PlatformAuditLog;
};
