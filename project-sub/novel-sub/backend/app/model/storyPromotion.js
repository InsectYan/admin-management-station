'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;
  return app.model.define('story_promotion', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    video_project_id: { type: STRING(64), allowNull: false },
    shot_id: { type: STRING(64), allowNull: false },
    chapter_id: { type: STRING(80), allowNull: false },
    package_version: { type: INTEGER, allowNull: true },
    field: { type: STRING(32), allowNull: false, defaultValue: 'dialogue' },
    before_text: { type: TEXT, allowNull: false },
    after_text: { type: TEXT, allowNull: false },
    operator_id: { type: STRING(64), allowNull: true },
    status: { type: STRING(16), allowNull: false, defaultValue: 'pending' },
    reason: { type: TEXT, allowNull: true },
  }, {
    tableName: 'story_promotions',
    underscored: true,
  });
};
