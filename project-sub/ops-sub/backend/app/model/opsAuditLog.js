'use strict';

module.exports = app => {
  const { BIGINT, STRING, JSONB } = app.Sequelize;
  return app.model.define('ops_audit_log', {
    id: { type: BIGINT, primaryKey: true, autoIncrement: true },
    actor: { type: STRING(128), allowNull: false },
    action: { type: STRING(64), allowNull: false },
    biz_app: { type: STRING(32), allowNull: true },
    external_type: { type: STRING(32), allowNull: true },
    external_id: { type: STRING(64), allowNull: true },
    detail: { type: JSONB, allowNull: false, defaultValue: {} },
  }, {
    tableName: 'ops_audit_logs',
  });
};
