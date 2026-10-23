'use strict';

module.exports = app => {
  const { INTEGER, STRING, JSONB } = app.Sequelize;
  return app.model.define('story_activity', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'novels', key: 'id' },
      onDelete: 'CASCADE',
    },
    actor: { type: STRING(64), allowNull: false },
    action: { type: STRING(32), allowNull: false },
    chapter_id: { type: STRING(80), allowNull: false, defaultValue: '' },
    detail: { type: JSONB, allowNull: false, defaultValue: {} },
  }, {
    tableName: 'story_activity',
    underscored: true,
  });
};
