'use strict';

module.exports = app => {
  const { STRING, INTEGER, REAL, TEXT, JSONB, UUID } = app.Sequelize;

  const TestRun = app.model.define(
    'test_run',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      batch_id: { type: UUID },
      item_id: { type: STRING(64) },
      env_id: { type: INTEGER },
      mode: {
        type: STRING(16),
        allowNull: false,
        defaultValue: 'functional',
        validate: { isIn: [[ 'functional', 'performance' ]] },
      },
      status: {
        type: STRING(16),
        allowNull: false,
        defaultValue: 'pending',
        validate: { isIn: [[ 'pending', 'running', 'success', 'failed', 'cancelled' ]] },
      },
      progress: { type: REAL, defaultValue: 0 },
      concurrency: { type: INTEGER, defaultValue: 1 },
      total_requests: { type: INTEGER },
      success_requests: { type: INTEGER },
      error_requests: { type: INTEGER },
      perf_analysis: { type: JSONB },
      perf_analysis_status: {
        type: STRING(16),
        defaultValue: 'none',
        validate: { isIn: [[ 'none', 'pending', 'done', 'failed' ]] },
      },
      agent_run_id: { type: INTEGER },
      error_message: { type: TEXT },
      log_tail: { type: TEXT },
      perf_options: { type: JSONB, defaultValue: {} },
      started_at: { type: app.Sequelize.DATE },
      finished_at: { type: app.Sequelize.DATE },
    },
    { tableName: 'test_runs' },
  );

  TestRun.associate = function associate() {
    app.model.TestRun.belongsTo(app.model.EnvConfig, { foreignKey: 'env_id' });
    app.model.TestRun.hasMany(app.model.FuncResult, { foreignKey: 'run_id' });
    app.model.TestRun.hasMany(app.model.PerfResult, { foreignKey: 'run_id' });
  };

  return TestRun;
};
