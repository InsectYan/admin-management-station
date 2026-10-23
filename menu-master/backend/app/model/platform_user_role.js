'use strict';

module.exports = app => {
  const { INTEGER, DATE } = app.Sequelize;
  const PlatformUserRole = app.model.define('platform_user_role', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: INTEGER, allowNull: false },
    role_id: { type: INTEGER, allowNull: false },
    created_at: DATE,
  }, {
    tableName: 'platform_user_roles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
  return PlatformUserRole;
};
