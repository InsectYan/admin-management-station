'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, JSONB, DATE } = app.Sequelize;

  const GenerationJob = app.model.define(
    'generation_job',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      document_id: { type: INTEGER },
      project_code: { type: STRING(64) },
      project_name: { type: STRING(255) },
      module: { type: STRING(64), allowNull: true },
      test_types: { type: JSONB, allowNull: false, defaultValue: [] },
      options: { type: JSONB, defaultValue: {} },
      status: { type: STRING(32), allowNull: false, defaultValue: 'pending' },
      current_phase: { type: STRING(32), defaultValue: 'analyze' },
      progress: {
        type: JSONB,
        defaultValue: { analyze: 0, generate: 0, review: 0 },
      },
      steps_log: { type: JSONB, defaultValue: [] },
      agent_run_id: { type: INTEGER },
      agent_context: { type: JSONB, defaultValue: {} },
      error_message: { type: TEXT },
      created_by: { type: STRING(100) },
      started_at: { type: DATE },
      finished_at: { type: DATE },
    },
    {
      tableName: 'generation_jobs',
    },
  );

  GenerationJob.associate = function associate() {
    app.model.GenerationJob.belongsTo(app.model.Document, { foreignKey: 'document_id' });
  };

  return GenerationJob;
};
