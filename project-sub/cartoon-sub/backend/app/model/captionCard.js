'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, BOOLEAN } = app.Sequelize;
  return app.model.define('cartoon_caption_card', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    media_kind: { type: STRING(16), allowNull: false, defaultValue: 'image' },
    stored_name: { type: STRING(240), allowNull: false, defaultValue: '' },
    original_name: { type: STRING(240), allowNull: false, defaultValue: '' },
    extra_prompt: { type: TEXT, allowNull: false, defaultValue: '' },
    result_prompt: { type: TEXT, allowNull: false, defaultValue: '' },
    shared_extra: { type: TEXT, allowNull: false, defaultValue: '' },
    workflow_id: { type: INTEGER, allowNull: true },
    workflow_name: { type: STRING(200), allowNull: false, defaultValue: '' },
    status: { type: STRING(32), allowNull: false, defaultValue: 'idle' },
    prompt_id: { type: STRING(64), allowNull: true },
    phase: { type: STRING(32), allowNull: false, defaultValue: '' },
    progress_value: { type: INTEGER, allowNull: false, defaultValue: 0 },
    progress_max: { type: INTEGER, allowNull: false, defaultValue: 0 },
    progress_percent: { type: INTEGER, allowNull: false, defaultValue: 0 },
    node: { type: STRING(64), allowNull: false, defaultValue: '' },
    error_message: { type: TEXT, allowNull: false, defaultValue: '' },
    saved: { type: BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'cartoon_caption_cards',
    indexes: [
      { fields: [ 'project_id' ] },
      { fields: [ 'status' ] },
    ],
  });
};
