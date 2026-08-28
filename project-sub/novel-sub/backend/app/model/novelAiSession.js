'use strict';

module.exports = (app) => {
  const { STRING, INTEGER, JSONB } = app.Sequelize;

  const NovelAiSession = app.model.define('novel_ai_session', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: true },
    feature_key: { type: STRING(40), allowNull: false },
    title: { type: STRING(200), allowNull: true },
    status: { type: STRING(20), allowNull: false, defaultValue: 'active' },
    bound_context_json: { type: JSONB, defaultValue: {} },
  }, {
    tableName: 'novel_ai_sessions',
    underscored: true,
  });

  NovelAiSession.associate = function associate() {
    app.model.NovelAiSession.belongsTo(app.model.Novel, {
      foreignKey: 'novel_id',
      as: 'novel',
    });
    app.model.NovelAiSession.hasMany(app.model.NovelAiMessage, {
      foreignKey: 'session_id',
      as: 'messages',
    });
  };

  return NovelAiSession;
};
