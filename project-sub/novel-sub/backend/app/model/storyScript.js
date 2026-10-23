'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, JSONB } = app.Sequelize;
  return app.model.define('story_script', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    title: { type: STRING(200), allowNull: false },
    variant: { type: STRING(32), allowNull: false, defaultValue: 'comic' },
    chapter_ids: { type: JSONB, allowNull: false, defaultValue: [] },
    scenes: { type: JSONB, allowNull: false, defaultValue: [] },
  }, {
    tableName: 'story_scripts',
    underscored: true,
  });
};
