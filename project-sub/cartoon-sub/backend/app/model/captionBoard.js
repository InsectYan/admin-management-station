'use strict';

module.exports = app => {
  const { TEXT, INTEGER } = app.Sequelize;
  return app.model.define('cartoon_caption_board', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false, unique: true },
    shared_prompt: { type: TEXT, allowNull: false, defaultValue: '' },
    workflow_id: { type: INTEGER, allowNull: true },
  }, { tableName: 'cartoon_caption_boards' });
};
