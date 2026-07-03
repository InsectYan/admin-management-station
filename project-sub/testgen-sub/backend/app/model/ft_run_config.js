'use strict';

module.exports = app => {
  const { INTEGER, STRING, JSONB } = app.Sequelize;
  return app.model.define('ft_run_config', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    item_id: { type: STRING(64), allowNull: false },
    scheme_id: { type: STRING(16), allowNull: false },
    config_json: { type: JSONB, defaultValue: {} },
    threshold_json: { type: JSONB, defaultValue: {} },
    env_id: { type: INTEGER },
    sample_set_id: { type: INTEGER },
    api_template_id: { type: INTEGER },
    use_api_template: { type: require('sequelize').BOOLEAN, defaultValue: false },
    inject_bindings: { type: JSONB, defaultValue: {} },
  }, { tableName: 'ft_run_config' });
};
