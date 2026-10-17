'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, DATE } = app.Sequelize;
  return app.model.define('ops_alert', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    rule_key: { type: STRING(64), allowNull: false },
    object_key: { type: STRING(200), allowNull: false },
    level: { type: STRING(16), allowNull: false, defaultValue: 'warning' },
    title: { type: STRING(200), allowNull: false },
    detail: { type: TEXT, allowNull: true },
    status: { type: STRING(16), allowNull: false, defaultValue: 'open' },
    assignee: { type: STRING(128), allowNull: true },
    note: { type: TEXT, allowNull: true },
    acked_at: { type: DATE, allowNull: true },
    resolved_at: { type: DATE, allowNull: true },
  }, {
    tableName: 'ops_alerts',
  });
};
