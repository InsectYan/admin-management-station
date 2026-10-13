'use strict';

module.exports = app => {
  const { STRING, INTEGER } = app.Sequelize;
  const Runtime = app.model.define('precheck_runtime', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(200), allowNull: false },
    base_url: { type: STRING(500), allowNull: false },
    expected_version: { type: STRING(32), allowNull: false, defaultValue: '0.39.0' },
  }, { tableName: 'precheck_runtimes' });
  return Runtime;
};
