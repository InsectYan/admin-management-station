'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, BOOLEAN } = app.Sequelize;
  return app.model.define('export_spec', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'cartoon_projects', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    preset: { type: STRING(32), allowNull: false },
    width: { type: INTEGER, allowNull: false },
    height: { type: INTEGER, allowNull: false },
    fps: { type: INTEGER, allowNull: false },
    bitrate_kbps: { type: INTEGER, allowNull: false },
    format: { type: STRING(16), allowNull: false, defaultValue: 'mp4' },
    subtitle_mode: { type: STRING(16), allowNull: false, defaultValue: 'burn' },
    voice_track: { type: BOOLEAN, allowNull: false, defaultValue: true },
    bgm_track: { type: BOOLEAN, allowNull: false, defaultValue: false },
    cover_note: { type: TEXT, allowNull: false, defaultValue: '' },
    lang: { type: TEXT, allowNull: false, defaultValue: '' },
    status: { type: STRING(32), allowNull: false, defaultValue: 'waiting_master' },
    source_output_id: { type: INTEGER, allowNull: true },
    file_path: { type: STRING(500), allowNull: false, defaultValue: '' },
    duration_ms: { type: INTEGER, allowNull: true },
    error_message: { type: TEXT, allowNull: false, defaultValue: '' },
    burned_subtitle: { type: BOOLEAN, allowNull: false, defaultValue: false },
    mixed_bgm: { type: BOOLEAN, allowNull: false, defaultValue: false },
    ai_marked: { type: BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'cartoon_export_specs',
    underscored: true,
  });
};
