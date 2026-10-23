'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;
  return app.model.define('story_dialogue', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'novels', key: 'id' },
      onDelete: 'CASCADE',
    },
    chapter_id: { type: STRING(80), allowNull: false },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 1 },
    speaker: { type: STRING(80), allowNull: false },
    line: { type: TEXT, allowNull: false },
  }, {
    tableName: 'story_dialogues',
    underscored: true,
  });
};
