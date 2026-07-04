'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, JSONB, DATE } = app.Sequelize;

  const ApiTemplateGenerationJob = app.model.define(
    'api_template_generation_job',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      document_id: { type: INTEGER },
      project_code: { type: STRING(64) },
      project_name: { type: STRING(255) },
      options: { type: JSONB, defaultValue: {} },
      status: { type: STRING(32), allowNull: false, defaultValue: 'pending' },
      current_phase: { type: STRING(32), defaultValue: 'analyze' },
      progress: {
        type: JSONB,
        defaultValue: { overall_percent: 0, analyze: 0, generate: 0, review: 0 },
      },
      steps_log: { type: JSONB, defaultValue: [] },
      agent_context: { type: JSONB, defaultValue: {} },
      error_message: { type: TEXT },
      import_status: { type: STRING(32), defaultValue: 'pending' },
      imported_count: { type: INTEGER, defaultValue: 0 },
      created_by: { type: STRING(100) },
      started_at: { type: DATE },
      finished_at: { type: DATE },
    },
    {
      tableName: 'api_template_generation_jobs',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  ApiTemplateGenerationJob.associate = function associate() {
    app.model.ApiTemplateGenerationJob.belongsTo(app.model.Document, { foreignKey: 'document_id' });
  };

  return ApiTemplateGenerationJob;
};
