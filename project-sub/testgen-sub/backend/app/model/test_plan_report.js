'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;
  return app.model.define('test_plan_report', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    plan_id: { type: INTEGER, allowNull: false },
    report_format: { type: STRING(16), defaultValue: 'markdown' },
    content: { type: TEXT },
    exported_at: { type: app.Sequelize.DATE, defaultValue: app.Sequelize.NOW },
  }, { tableName: 'test_plan_report', timestamps: false });
};
