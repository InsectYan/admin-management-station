'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, JSONB } = app.Sequelize;

  const KnowledgeEntry = app.model.define(
    'knowledge_entry',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      module: { type: STRING(64), allowNull: false },
      tag: { type: STRING(64) },
      title: { type: STRING(255) },
      content: { type: TEXT, allowNull: false },
      entity_refs: { type: JSONB, defaultValue: [] },
    },
    {
      tableName: 'knowledge_entries',
    },
  );

  return KnowledgeEntry;
};
