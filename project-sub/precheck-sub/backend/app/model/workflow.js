'use strict';

module.exports = app => {
  const { STRING, INTEGER, JSONB } = app.Sequelize;
  const Workflow = app.model.define('precheck_workflow', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(200), allowNull: false },
    category: { type: STRING(64), allowNull: false, defaultValue: 'text_to_image' },
    api_json: { type: JSONB, allowNull: false },
    required_nodes: { type: JSONB, allowNull: false, defaultValue: [] },
    required_models: { type: JSONB, allowNull: false, defaultValue: [] },
    suggested_vram_gb: { type: INTEGER, allowNull: true },
    preview_json: { type: JSONB, allowNull: true },
  }, { tableName: 'precheck_workflows' });
  return Workflow;
};
