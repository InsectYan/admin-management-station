'use strict';

module.exports = app => {
  const { STRING, BOOLEAN } = app.Sequelize;
  return app.model.define('ops_model_gate', {
    id: { type: app.Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    catalog: { type: STRING(16), allowNull: false },
    profile_id: { type: STRING(80), allowNull: false },
    enabled: { type: BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'ops_model_gates',
  });
};
