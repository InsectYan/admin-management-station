'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, BOOLEAN } = app.Sequelize;
  return app.model.define('ops_compliance_rule', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    kind: { type: STRING(32), allowNull: false },
    name: { type: STRING(120), allowNull: false },
    body: { type: TEXT, allowNull: false, defaultValue: '' },
    enabled: { type: BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'ops_compliance_rules',
  });
};
