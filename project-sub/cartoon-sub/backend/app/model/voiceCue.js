'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;
  return app.model.define('cartoon_voice_cue', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    shot_id: { type: INTEGER, allowNull: false },
    text: { type: TEXT, allowNull: false, defaultValue: '' },
    start_ms: { type: INTEGER, allowNull: false, defaultValue: 0 },
    end_ms: { type: INTEGER, allowNull: false, defaultValue: 0 },
    voice_key: { type: STRING(80), allowNull: false, defaultValue: '' },
    media_ref: { type: STRING(200), allowNull: false, defaultValue: '' },
  }, { tableName: 'cartoon_voice_cues' });
};
