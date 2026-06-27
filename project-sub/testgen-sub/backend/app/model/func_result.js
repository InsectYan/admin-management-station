'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, JSONB } = app.Sequelize;

  const FuncResult = app.model.define(
    'func_result',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      run_id: { type: INTEGER, allowNull: false },
      request_index: { type: INTEGER, defaultValue: 0 },
      status: {
        type: STRING(16),
        allowNull: false,
        validate: { isIn: [[ 'success', 'failed' ]] },
      },
      response_time_ms: { type: INTEGER },
      http_status_code: { type: INTEGER },
      response_body: { type: JSONB },
      error_message: { type: TEXT },
      assertion_details: { type: JSONB, defaultValue: [] },
    },
    { tableName: 'func_results', updatedAt: false },
  );

  FuncResult.associate = function associate() {
    app.model.FuncResult.belongsTo(app.model.TestRun, { foreignKey: 'run_id' });
  };

  return FuncResult;
};
