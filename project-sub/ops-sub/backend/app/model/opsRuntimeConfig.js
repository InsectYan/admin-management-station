'use strict';

module.exports = app => {
  const { INTEGER, DECIMAL, BOOLEAN } = app.Sequelize;
  return app.model.define('ops_runtime_config', {
    id: { type: INTEGER, primaryKey: true },
    queue_backlog: { type: INTEGER, allowNull: false, defaultValue: 20 },
    stuck_minutes: { type: INTEGER, allowNull: false, defaultValue: 30 },
    fail_rate: { type: DECIMAL(6, 4), allowNull: false, defaultValue: 0.5 },
    fail_min_samples: { type: INTEGER, allowNull: false, defaultValue: 3 },
    retention_days: { type: INTEGER, allowNull: false, defaultValue: 30 },
    require_moderation: { type: BOOLEAN, allowNull: false, defaultValue: false },
    probe_interval_sec: { type: INTEGER, allowNull: false, defaultValue: 15 },
    allow_prompt_view: { type: BOOLEAN, allowNull: false, defaultValue: false },
    storage_watermark_mb: { type: INTEGER, allowNull: false, defaultValue: 10240 },
  }, {
    tableName: 'ops_runtime_config',
  });
};
