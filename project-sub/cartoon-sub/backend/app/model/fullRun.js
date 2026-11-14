'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, BOOLEAN } = app.Sequelize;
  return app.model.define('full_run', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    import_id: { type: INTEGER, allowNull: false },
    chapter_title: { type: STRING(200), allowNull: false, defaultValue: '' },
    status: { type: STRING(32), allowNull: false, defaultValue: 'running' },
    current_node: { type: STRING(32), allowNull: false, defaultValue: 'script' },
    message: { type: TEXT, allowNull: false, defaultValue: '' },
    error_message: { type: TEXT, allowNull: false, defaultValue: '' },
    asset_workflow_id: { type: INTEGER, allowNull: false },
    frame_workflow_id: { type: INTEGER, allowNull: false },
    video_workflow_id: { type: INTEGER, allowNull: false },
    asset_workflow_name: { type: STRING(300), allowNull: false, defaultValue: '' },
    frame_workflow_name: { type: STRING(300), allowNull: false, defaultValue: '' },
    video_workflow_name: { type: STRING(300), allowNull: false, defaultValue: '' },
    asset_width: { type: INTEGER, allowNull: false, defaultValue: 0 },
    asset_height: { type: INTEGER, allowNull: false, defaultValue: 0 },
    frame_width: { type: INTEGER, allowNull: false, defaultValue: 0 },
    frame_height: { type: INTEGER, allowNull: false, defaultValue: 0 },
    nodes: { type: TEXT, allowNull: false, defaultValue: '{}' },
    log: { type: TEXT, allowNull: false, defaultValue: '[]' },
    done_shot_ids: { type: TEXT, allowNull: false, defaultValue: '[]' },
    task_ids: { type: TEXT, allowNull: false, defaultValue: '[]' },
    video_done: { type: INTEGER, allowNull: false, defaultValue: 0 },
    video_total: { type: INTEGER, allowNull: false, defaultValue: 0 },
    fresh: { type: BOOLEAN, allowNull: false, defaultValue: false },
    scope: { type: STRING(32), allowNull: false, defaultValue: 'all' },
    temp_refmod_id: { type: INTEGER, allowNull: true },
  }, {
    tableName: 'cartoon_full_runs',
    underscored: true,
  });
};
