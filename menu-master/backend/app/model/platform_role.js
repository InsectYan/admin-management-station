'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, DATE } = app.Sequelize;
  const PlatformRole = app.model.define('platform_role', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    app_code: { type: STRING(50), allowNull: false },
    app_name: { type: STRING(100), allowNull: false },
    code: { type: STRING(50), allowNull: false },
    name: { type: STRING(100), allowNull: false },
    remark: { type: TEXT, allowNull: true },
    status: { type: STRING(20), allowNull: false, defaultValue: 'enabled' },
    created_at: DATE,
    updated_at: DATE,
  }, {
    tableName: 'platform_roles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
  return PlatformRole;
};
