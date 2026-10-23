'use strict';

module.exports = app => {
  const { INTEGER, STRING } = app.Sequelize;
  return app.model.define('story_member', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'novels', key: 'id' },
      onDelete: 'CASCADE',
    },
    username: { type: STRING(64), allowNull: false },
    role: { type: STRING(16), allowNull: false },
  }, {
    tableName: 'story_members',
    underscored: true,
  });
};
