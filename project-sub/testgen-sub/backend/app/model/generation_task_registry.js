'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;

  const GenerationTaskRegistry = app.model.define(
    'generation_task_registry',
    {
      job_id: { type: INTEGER, primaryKey: true },
      task_name: { type: STRING(255), allowNull: false },
      created_at: { type: DATE },
    },
    {
      tableName: 'generation_task_registry',
      timestamps: false,
    },
  );

  GenerationTaskRegistry.associate = function associate() {
    app.model.GenerationTaskRegistry.belongsTo(app.model.GenerationJob, {
      foreignKey: 'job_id',
    });
  };

  return GenerationTaskRegistry;
};
