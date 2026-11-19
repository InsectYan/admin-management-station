'use strict';

module.exports = app => {
  const { STRING, INTEGER, BOOLEAN, TEXT } = app.Sequelize;
  return app.model.define('auto_job', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'cartoon_projects', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    status: { type: STRING(32), allowNull: false, defaultValue: 'running' },
    total: { type: INTEGER, allowNull: false, defaultValue: 0 },
    done: { type: INTEGER, allowNull: false, defaultValue: 0 },
    success_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    failed_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    skipped_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    video_count: { type: INTEGER, allowNull: false, defaultValue: 1 },
    generate_end: { type: BOOLEAN, allowNull: false, defaultValue: true },
    fail_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    import_id: { type: INTEGER, allowNull: true },
    frame_workflow_id: { type: INTEGER, allowNull: false, defaultValue: 0 },
    frame_width: { type: INTEGER, allowNull: false, defaultValue: 1024 },
    frame_height: { type: INTEGER, allowNull: false, defaultValue: 1024 },
    video_workflow_id: { type: INTEGER, allowNull: false, defaultValue: 0 },
    asset_workflow_id: { type: INTEGER, allowNull: false, defaultValue: 0 },
    asset_width: { type: INTEGER, allowNull: false, defaultValue: 1024 },
    asset_height: { type: INTEGER, allowNull: false, defaultValue: 1024 },
    task_ids: { type: TEXT, allowNull: false, defaultValue: '[]' },
    temp_refmod_id: { type: INTEGER, allowNull: true },
  }, {
    tableName: 'cartoon_auto_jobs',
    underscored: true,
  });
};
