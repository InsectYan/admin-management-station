'use strict';

module.exports = app => {
  const { STRING, INTEGER, JSONB, DATE } = app.Sequelize;

  const GenerationJobQueue = app.model.define(
    'generation_job_queue',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      job_id: { type: INTEGER, allowNull: false, unique: true },
      task_name: { type: STRING(255), allowNull: false },
      queue_status: { type: STRING(32), allowNull: false, defaultValue: 'waiting' },
      queue_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
      payload: { type: JSONB, allowNull: false, defaultValue: {} },
      progress_percent: { type: INTEGER, allowNull: false, defaultValue: 0 },
      current_phase: { type: STRING(32), defaultValue: 'analyze' },
      project_code: { type: STRING(64) },
      project_name: { type: STRING(255) },
      created_at: { type: DATE },
      updated_at: { type: DATE },
    },
    {
      tableName: 'generation_job_queue',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  GenerationJobQueue.associate = function associate() {
    app.model.GenerationJobQueue.belongsTo(app.model.GenerationJob, {
      foreignKey: 'job_id',
    });
  };

  return GenerationJobQueue;
};
