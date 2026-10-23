'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, BOOLEAN } = app.Sequelize;
  return app.model.define('agent_config', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    content_type: { type: STRING(32), allowNull: false },
    role: { type: STRING(32), allowNull: false },
    input_text: { type: TEXT, allowNull: false, defaultValue: '' },
    output_text: { type: TEXT, allowNull: false, defaultValue: '' },
    model_profile: { type: STRING(64), allowNull: false, defaultValue: '' },
    rule_text: { type: TEXT, allowNull: false, defaultValue: '' },
    retry_count: { type: INTEGER, allowNull: false, defaultValue: 1 },
    human_confirm: { type: BOOLEAN, allowNull: false, defaultValue: false },
    enabled: { type: BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'cartoon_agent_configs',
    underscored: true,
  });
};
