'use strict';

module.exports = app => {
  const { TEXT, INTEGER, DOUBLE } = app.Sequelize;
  return app.model.define('cartoon_caption_board', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false, unique: true },
    shared_prompt: { type: TEXT, allowNull: false, defaultValue: '' },
    workflow_id: { type: INTEGER, allowNull: true },
    max_tokens: { type: INTEGER, allowNull: false, defaultValue: 2048 },
    video_fps: { type: DOUBLE, allowNull: true },
    batch_total: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, { tableName: 'cartoon_caption_boards' });
};
