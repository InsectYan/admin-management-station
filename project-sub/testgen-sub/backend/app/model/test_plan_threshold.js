'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, DECIMAL } = app.Sequelize;
  return app.model.define('test_plan_threshold', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    plan_id: { type: INTEGER, allowNull: false },
    param_id: { type: STRING(64), allowNull: false },
    param_value: { type: DECIMAL(12, 4), allowNull: false },
    notes: { type: TEXT },
  }, { tableName: 'test_plan_threshold', updatedAt: false });
};
