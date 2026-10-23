'use strict';

module.exports = app => {
  const { INTEGER } = app.Sequelize;
  return app.model.define('ops_compliance_state', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    version: { type: INTEGER, allowNull: false, defaultValue: 1 },
  }, {
    tableName: 'ops_compliance_state',
  });
};
