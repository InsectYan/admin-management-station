'use strict';

module.exports = app => {
  const { INTEGER, STRING } = app.Sequelize;
  return app.model.define('test_plan_scope', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    plan_id: { type: INTEGER, allowNull: false },
    scope_type: { type: STRING(32), allowNull: false },
    scope_value: { type: STRING(64), allowNull: false },
  }, { tableName: 'test_plan_scope', updatedAt: false });
};
