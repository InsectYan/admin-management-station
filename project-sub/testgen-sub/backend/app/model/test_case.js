'use strict';

module.exports = app => {
  const { STRING, INTEGER, REAL, TEXT, JSONB } = app.Sequelize;

  const TestCase = app.model.define(
    'test_case',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      job_id: { type: INTEGER },
      case_id: { type: STRING(64), allowNull: false },
      title: { type: STRING(255), allowNull: false },
      module: { type: STRING(64) },
      type: { type: STRING(32) },
      priority: {
        type: STRING(16),
        defaultValue: 'medium',
        validate: { isIn: [[ 'high', 'medium', 'low' ]] },
      },
      status: {
        type: STRING(20),
        defaultValue: 'pending',
        validate: { isIn: [[ 'pending', 'running', 'passed', 'failed' ]] },
      },
      confidence: {
        type: REAL,
        defaultValue: 0,
        validate: { min: 0, max: 1 },
      },
      compliance: { type: STRING(32), defaultValue: 'unverified' },
      preconditions: { type: TEXT },
      steps: { type: JSONB, allowNull: false, defaultValue: [] },
      expected: { type: TEXT },
      tags: { type: JSONB, defaultValue: [] },
      document_id: { type: INTEGER },
      http_config: { type: JSONB },
    },
    {
      tableName: 'test_cases',
    },
  );

  TestCase.associate = function associate() {
    app.model.TestCase.belongsTo(app.model.GenerationJob, { foreignKey: 'job_id' });
    app.model.TestCase.belongsTo(app.model.Document, { foreignKey: 'document_id' });
  };

  return TestCase;
};
