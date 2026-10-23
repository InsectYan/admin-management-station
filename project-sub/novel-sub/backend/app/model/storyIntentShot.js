'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT, JSONB } = app.Sequelize;
  return app.model.define('story_intent_shot', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    script_id: { type: INTEGER, allowNull: true },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 1 },
    scene_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
    intent: { type: TEXT, allowNull: false, defaultValue: '' },
    dialogue: { type: TEXT, allowNull: false, defaultValue: '' },
    emotion: { type: STRING(40), allowNull: false, defaultValue: '' },
    location: { type: STRING(120), allowNull: false, defaultValue: '' },
    character_ids: { type: JSONB, allowNull: false, defaultValue: [] },
  }, {
    tableName: 'story_intent_shots',
    underscored: true,
  });
};
