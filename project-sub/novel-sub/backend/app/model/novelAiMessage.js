'use strict';

module.exports = (app) => {
  const { STRING, INTEGER, TEXT, BOOLEAN, JSONB } = app.Sequelize;

  const NovelAiMessage = app.model.define('novel_ai_message', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    session_id: { type: INTEGER, allowNull: false },
    role: { type: STRING(20), allowNull: false },
    content: { type: TEXT, allowNull: true },
    target_fields_json: { type: JSONB, defaultValue: [] },
    patch_json: { type: JSONB, defaultValue: {} },
    applied: { type: BOOLEAN, allowNull: false, defaultValue: false },
    trace_id: { type: STRING(80), allowNull: true },
    scene: { type: STRING(80), allowNull: true },
  }, {
    tableName: 'novel_ai_messages',
    underscored: true,
  });

  NovelAiMessage.associate = function associate() {
    app.model.NovelAiMessage.belongsTo(app.model.NovelAiSession, {
      foreignKey: 'session_id',
      as: 'session',
      onDelete: 'CASCADE',
    });
  };

  return NovelAiMessage;
};
