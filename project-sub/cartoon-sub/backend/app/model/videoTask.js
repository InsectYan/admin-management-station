'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT } = app.Sequelize;
  return app.model.define('cartoon_video_task', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    episode_no: { type: INTEGER, allowNull: false, defaultValue: 1 },
    title: { type: STRING(200), allowNull: false, defaultValue: '' },
    current_node: { type: STRING(32), allowNull: false, defaultValue: 'input' },
    status: { type: STRING(32), allowNull: false, defaultValue: 'draft' },
    warning: { type: TEXT, allowNull: false, defaultValue: '' },
  }, { tableName: 'cartoon_video_tasks' });
};
