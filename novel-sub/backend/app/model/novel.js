'use strict';

module.exports = app => {
  const { STRING, INTEGER, JSONB } = app.Sequelize;

  const Novel = app.model.define(
    'novel',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: STRING(255), allowNull: false },
      author_name: { type: STRING(128), allowNull: false, defaultValue: '' },
      status: { type: STRING(50), allowNull: false, defaultValue: 'draft' },
      progress: { type: INTEGER, allowNull: false, defaultValue: 0 },
      word_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      plot: { type: JSONB },
      draft: { type: JSONB },
    },
    {
      tableName: 'novels',
    },
  );

  return Novel;
};
