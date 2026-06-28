'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;
  return app.model.define('test_plan_item_result', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    plan_id: { type: INTEGER, allowNull: false },
    plan_item_id: { type: INTEGER, allowNull: false },
    result_status: { type: STRING(16), defaultValue: 'pending' },
    validation_result: { type: STRING(32) },
    notes: { type: TEXT },
    defect_url: { type: STRING(512) },
    ft_run_id: { type: INTEGER },
  }, { tableName: 'test_plan_item_result' });
};
