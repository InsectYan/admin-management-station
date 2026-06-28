'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, JSONB } = app.Sequelize;
  return app.model.define('ft_run_result', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    ft_run_id: { type: INTEGER, allowNull: false },
    sub_index: { type: INTEGER, defaultValue: 0 },
    input_summary: { type: TEXT },
    output_summary: { type: TEXT },
    assertion_detail: { type: JSONB, defaultValue: [] },
    sub_verdict: { type: STRING(16) },
  }, { tableName: 'ft_run_result', updatedAt: false });
};
