'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, JSONB, DATE } = app.Sequelize;
  return app.model.define('ft_run_step', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    ft_run_id: { type: INTEGER, allowNull: false },
    step_index: { type: INTEGER, defaultValue: 0 },
    sub_index: { type: INTEGER },
    step_name: { type: STRING(256) },
    runner: { type: STRING(32), defaultValue: 'http' },
    source: { type: STRING(32), defaultValue: 'config' },
    status: { type: STRING(16), defaultValue: 'running' },
    started_at: { type: DATE },
    ended_at: { type: DATE },
    duration_ms: { type: INTEGER },
    trace_id: { type: STRING(64) },
    input_summary: { type: TEXT },
    output_summary: { type: TEXT },
    detail: { type: JSONB, defaultValue: {} },
  }, { tableName: 'ft_run_step', updatedAt: false });
};
