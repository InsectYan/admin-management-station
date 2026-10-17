'use strict';

module.exports = app => {
  const { INTEGER, TEXT } = app.Sequelize;
  return app.model.define('cartoon_edit_clip', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    track_id: { type: INTEGER, allowNull: false },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
    source_output_id: { type: INTEGER, allowNull: true },
    start_ms: { type: INTEGER, allowNull: false, defaultValue: 0 },
    duration_ms: { type: INTEGER, allowNull: false },
    trim_in_ms: { type: INTEGER, allowNull: false, defaultValue: 0 },
    text: { type: TEXT, allowNull: true },
  }, { tableName: 'cartoon_edit_clips' });
};
