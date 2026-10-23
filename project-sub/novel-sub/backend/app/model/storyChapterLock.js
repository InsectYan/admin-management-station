'use strict';

module.exports = app => {
  const { INTEGER, STRING } = app.Sequelize;
  return app.model.define('story_chapter_lock', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'novels', key: 'id' },
      onDelete: 'CASCADE',
    },
    chapter_id: { type: STRING(80), allowNull: false },
    holder: { type: STRING(64), allowNull: false },
  }, {
    tableName: 'story_chapter_locks',
    underscored: true,
  });
};
