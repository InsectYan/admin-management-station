'use strict';

module.exports = (app) => {
  const { INTEGER, STRING } = app.Sequelize;
  return app.model.define('story_downstream', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    package_id: { type: STRING(64), allowNull: false },
    version: { type: INTEGER, allowNull: false },
    video_project_id: { type: STRING(64), allowNull: false, unique: true },
    content_type: { type: STRING(32), allowNull: false, defaultValue: 'ai_comic' },
  }, {
    tableName: 'story_downstreams',
    underscored: true,
  });
};
