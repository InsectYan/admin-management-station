'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, BOOLEAN } = app.Sequelize;
  return app.model.define('cartoon_asset', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    kind: { type: STRING(32), allowNull: false, defaultValue: 'character' },
    name: { type: STRING(200), allowNull: false },
    description: { type: TEXT, allowNull: true },
    reference_path: { type: STRING(300), allowNull: false, defaultValue: '' },
    voice_key: { type: STRING(80), allowNull: false, defaultValue: '' },
    speech_rate: { type: STRING(32), allowNull: false, defaultValue: '' },
    emotion: { type: STRING(64), allowNull: false, defaultValue: '' },
    character_id: { type: STRING(80), allowNull: false, defaultValue: '' },
    disabled: { type: BOOLEAN, allowNull: false, defaultValue: false },
    consistency_note: { type: TEXT, allowNull: false, defaultValue: '' },
    scene_type: { type: STRING(32), allowNull: false, defaultValue: '' },
    front_path: { type: STRING(300), allowNull: false, defaultValue: '' },
    side_path: { type: STRING(300), allowNull: false, defaultValue: '' },
    back_path: { type: STRING(300), allowNull: false, defaultValue: '' },
    expression_note: { type: TEXT, allowNull: false, defaultValue: '' },
    costume_note: { type: TEXT, allowNull: false, defaultValue: '' },
    lora_ref: { type: STRING(200), allowNull: false, defaultValue: '' },
    angle_paths: { type: TEXT, allowNull: false, defaultValue: '' },
    prop_category: { type: STRING(32), allowNull: false, defaultValue: '' },
    voice_lang: { type: STRING(64), allowNull: false, defaultValue: '' },
    speaker_name: { type: STRING(80), allowNull: false, defaultValue: '' },
  }, { tableName: 'cartoon_assets' });
};
