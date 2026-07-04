'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, JSONB, BOOLEAN } = app.Sequelize;
  return app.model.define('ft_agent_audit_log', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    ft_run_id: { type: INTEGER },
    job_id: { type: INTEGER },
    item_id: { type: STRING(64) },
    skill: { type: STRING(64), allowNull: false },
    action: { type: STRING(64), allowNull: false },
    trace_id: { type: STRING(64) },
    ok: { type: BOOLEAN, defaultValue: true },
    error: { type: TEXT },
    tools: { type: JSONB, defaultValue: [] },
    detail: { type: JSONB, defaultValue: {} },
    duration_ms: { type: INTEGER },
  }, { tableName: 'ft_agent_audit_log', updatedAt: false });
};
