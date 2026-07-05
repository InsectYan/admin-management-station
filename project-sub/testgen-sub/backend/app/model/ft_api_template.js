'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, BOOLEAN, JSONB } = app.Sequelize;
  return app.model.define('ft_api_template', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    template_code: { type: STRING(64), allowNull: false, unique: true },
    name: { type: STRING(255), allowNull: false },
    description: { type: TEXT },
    project_code: { type: STRING(64) },
    http_method: { type: STRING(16), allowNull: false, defaultValue: 'POST' },
    url_path: { type: STRING(512), allowNull: false },
    headers_json: { type: JSONB, defaultValue: {} },
    query_json: { type: JSONB, defaultValue: {} },
    body_template: { type: JSONB, defaultValue: {} },
    inject_schema: { type: JSONB, defaultValue: [] },
    input_params_schema: { type: JSONB, defaultValue: [] },
    preflight_steps: { type: JSONB, defaultValue: [] },
    expect_status: { type: INTEGER, defaultValue: 202 },
    poll_json: { type: JSONB, defaultValue: {} },
    forbidden_patterns: { type: JSONB, defaultValue: [] },
    is_active: { type: BOOLEAN, defaultValue: true },
  }, { tableName: 'ft_api_template' });
};
