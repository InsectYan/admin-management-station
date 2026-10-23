'use strict';

module.exports = app => {
  const { STRING, INTEGER } = app.Sequelize;
  return app.model.define('ops_channel', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(80), allowNull: false },
    platform: { type: STRING(32), allowNull: false },
    auth_status: { type: STRING(32), allowNull: false, defaultValue: 'unauthorized' },
    secret_hash: { type: STRING(128), allowNull: false, defaultValue: '' },
  }, {
    tableName: 'ops_channels',
  });
};
