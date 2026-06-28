'use strict';

module.exports = app => {
  const { INTEGER, STRING } = app.Sequelize;
  return app.model.define('test_plan_item', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    plan_id: { type: INTEGER, allowNull: false },
    item_id: { type: STRING(64), allowNull: false },
    sort_order: { type: INTEGER, defaultValue: 0 },
  }, { tableName: 'test_plan_item', updatedAt: false });
};
