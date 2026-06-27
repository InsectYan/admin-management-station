'use strict';

module.exports = app => {
  const { INTEGER, REAL, DATE } = app.Sequelize;

  const PerfResult = app.model.define(
    'perf_result',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      run_id: { type: INTEGER, allowNull: false },
      window_start: { type: DATE, allowNull: false },
      tps: { type: REAL },
      avg_response_time_ms: { type: INTEGER },
      p95_response_time_ms: { type: INTEGER },
      error_rate: { type: REAL },
    },
    { tableName: 'perf_results', updatedAt: false },
  );

  PerfResult.associate = function associate() {
    app.model.PerfResult.belongsTo(app.model.TestRun, { foreignKey: 'run_id' });
  };

  return PerfResult;
};
