'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  return app.model.define('review', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'cartoon_projects', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    video_task_id: { type: INTEGER, allowNull: true },
    decision: { type: STRING(16), allowNull: false },
    node: { type: STRING(32), allowNull: false, defaultValue: '' },
    note: { type: TEXT, allowNull: false, defaultValue: '' },
    issues: { type: TEXT, allowNull: false, defaultValue: '' },
  }, {
    tableName: 'cartoon_reviews',
    underscored: true,
  });
};
