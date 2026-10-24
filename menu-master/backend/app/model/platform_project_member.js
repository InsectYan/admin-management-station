'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;
  return app.model.define('platform_project_member', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: INTEGER, allowNull: false },
    app_key: { type: STRING(32), allowNull: false },
    project_id: { type: INTEGER, allowNull: false },
    role: { type: STRING(32), allowNull: false },
    created_at: DATE,
    updated_at: DATE,
  }, {
    tableName: 'platform_project_members',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: [ 'user_id', 'app_key', 'project_id' ] },
    ],
  });
};
