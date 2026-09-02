'use strict';

module.exports = (app) => {
  const { STRING, INTEGER, TEXT, SMALLINT, JSONB } = app.Sequelize;

  const Novel = app.model.define('novel', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: STRING(200), allowNull: false },
    cover_url: { type: STRING(500), allowNull: true },
    genre: { type: STRING(50), allowNull: true },
    novel_type: { type: STRING(50), allowNull: true },
    progress_status: { type: STRING(20), defaultValue: 'ongoing' },
    progress_percent: { type: SMALLINT, defaultValue: 0 },
    summary: { type: TEXT, allowNull: true },
    creative_intent: { type: TEXT, allowNull: true },
    target_audience: { type: STRING(200), allowNull: true },
    update_cadence: { type: STRING(50), allowNull: true },
    setting_json: { type: JSONB, defaultValue: {} },
    author_name: { type: STRING(100), allowNull: true },
    status: { type: STRING(20), defaultValue: 'draft' },
    genre_category_id: { type: INTEGER, allowNull: true },
    genre_subcategory_id: { type: INTEGER, allowNull: true },
    length_id: { type: INTEGER, allowNull: true },
    audience_id: { type: INTEGER, allowNull: true },
    update_pace_id: { type: INTEGER, allowNull: true },
  }, {
    tableName: 'novels',
    underscored: true,
  });

  Novel.associate = function associate() {
    app.model.Novel.belongsTo(app.model.GenreCategory, {
      foreignKey: 'genre_category_id',
      as: 'genreCategory',
    });
    app.model.Novel.belongsTo(app.model.GenreSubcategory, {
      foreignKey: 'genre_subcategory_id',
      as: 'genreSubcategory',
    });
    app.model.Novel.belongsTo(app.model.LengthCategory, {
      foreignKey: 'length_id',
      as: 'lengthCategory',
    });
    app.model.Novel.belongsTo(app.model.AudienceCategory, {
      foreignKey: 'audience_id',
      as: 'audienceCategory',
    });
    app.model.Novel.belongsTo(app.model.UpdatePace, {
      foreignKey: 'update_pace_id',
      as: 'updatePace',
    });
    app.model.Novel.belongsToMany(app.model.ThemeCategory, {
      through: app.model.NovelTheme,
      foreignKey: 'novel_id',
      otherKey: 'theme_id',
      as: 'themes',
    });
    app.model.Novel.hasMany(app.model.NovelChapterBody, {
      foreignKey: 'novel_id',
      as: 'chapterBodies',
    });
  };

  return Novel;
};
