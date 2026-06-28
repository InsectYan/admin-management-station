'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, DATEONLY } = app.Sequelize;
  const TestPlan = app.model.define('test_plan', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(255), allowNull: false },
    version_tag: { type: STRING(64) },
    env_name: { type: STRING(64) },
    plan_type: { type: STRING(32), defaultValue: 'release' },
    status: { type: STRING(32), defaultValue: 'draft' },
    period_start: { type: DATEONLY },
    period_end: { type: DATEONLY },
    notes: { type: TEXT },
    created_by: { type: STRING(100) },
  }, { tableName: 'test_plan' });
  return TestPlan;
};
