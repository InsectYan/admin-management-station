'use strict';

module.exports = app => {
  const { INTEGER, STRING, BOOLEAN } = app.Sequelize;
  return app.model.define('ops_alert_rule', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    rule_key: { type: STRING(64), allowNull: false, unique: true },
    name: { type: STRING(100), allowNull: false },
    level: { type: STRING(16), allowNull: false, defaultValue: 'warning' },
    enabled: { type: BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'ops_alert_rules',
  });
};
