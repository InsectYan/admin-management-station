'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, JSONB, BOOLEAN } = app.Sequelize;
  return app.model.define('cartoon_shot', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    import_id: { type: INTEGER, allowNull: true },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
    shot_code: { type: STRING(16), allowNull: true },
    shot_size: { type: TEXT, allowNull: true },
    camera_move: { type: TEXT, allowNull: true },
    description: { type: TEXT, allowNull: true },
    video_task_id: { type: INTEGER, allowNull: true },
    dialogue: { type: TEXT, allowNull: true },
    duration_ms: { type: INTEGER, allowNull: true },
    workflow_id: { type: INTEGER, allowNull: true },
    emotion: { type: STRING(64), allowNull: true },
    upstream_intent_id: { type: STRING(80), allowNull: true },
    upstream_version: { type: INTEGER, allowNull: true },
    overridden_fields: { type: JSONB, allowNull: false, defaultValue: [] },
    upstream_stale: { type: BOOLEAN, allowNull: false, defaultValue: false },
    asset_stale: { type: BOOLEAN, allowNull: false, defaultValue: false },
    first_frame_path: { type: STRING(500), allowNull: true },
    manual_frame_path: { type: STRING(500), allowNull: true },
    stage_notes: { type: JSONB, allowNull: true },
    dialogue_lines: { type: JSONB, allowNull: true },
    scene_label: { type: STRING(200), allowNull: true },
  }, { tableName: 'cartoon_shots' });
};
