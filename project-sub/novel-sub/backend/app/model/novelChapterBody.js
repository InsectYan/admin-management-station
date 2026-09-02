'use strict';

module.exports = (app) => {
  const { STRING, INTEGER, TEXT } = app.Sequelize;

  const NovelChapterBody = app.model.define('novel_chapter_body', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    chapter_id: { type: STRING(80), allowNull: false },
    body: { type: TEXT, allowNull: false, defaultValue: '' },
    word_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'novel_chapter_bodies',
    underscored: true,
  });

  NovelChapterBody.associate = function associate() {
    app.model.NovelChapterBody.belongsTo(app.model.Novel, {
      foreignKey: 'novel_id',
      as: 'novel',
    });
  };

  return NovelChapterBody;
};
