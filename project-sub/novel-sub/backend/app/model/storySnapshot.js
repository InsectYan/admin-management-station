'use strict';

module.exports = app => {
  const { INTEGER, STRING, JSONB } = app.Sequelize;
  return app.model.define('story_snapshot', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'novels', key: 'id' },
      onDelete: 'CASCADE',
    },
    label: { type: STRING(80), allowNull: false },
    payload: { type: JSONB, allowNull: false, defaultValue: {} },
  }, {
    tableName: 'story_snapshots',
    underscored: true,
  });
};
