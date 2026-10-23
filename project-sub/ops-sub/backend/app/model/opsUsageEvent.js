'use strict';

module.exports = app => {
  const { STRING, INTEGER, BIGINT } = app.Sequelize;
  return app.model.define('ops_usage_event', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    actor: { type: STRING(128), allowNull: false, defaultValue: '' },
    biz_app: { type: STRING(32), allowNull: false },
    project_id: { type: STRING(64), allowNull: false },
    model_profile: { type: STRING(80), allowNull: false, defaultValue: '' },
    call_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    media_seconds: { type: INTEGER, allowNull: false, defaultValue: 0 },
    storage_bytes: { type: BIGINT, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'ops_usage_events',
  });
};
