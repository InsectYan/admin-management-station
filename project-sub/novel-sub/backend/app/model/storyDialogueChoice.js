'use strict';

module.exports = app => {
  const { INTEGER, STRING } = app.Sequelize;
  return app.model.define('story_dialogue_choice', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'novels', key: 'id' },
      onDelete: 'CASCADE',
    },
    dialogue_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'story_dialogues', key: 'id' },
      onDelete: 'CASCADE',
    },
    next_dialogue_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'story_dialogues', key: 'id' },
      onDelete: 'CASCADE',
    },
    label: { type: STRING(120), allowNull: false },
  }, {
    tableName: 'story_dialogue_choices',
    underscored: true,
  });
};
