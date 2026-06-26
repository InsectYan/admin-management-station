'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, JSONB } = app.Sequelize;

  const Document = app.model.define(
    'document',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: STRING(255), allowNull: false },
      doc_type: { type: STRING(32), allowNull: false, defaultValue: 'markdown' },
      content: { type: TEXT },
      file_path: { type: STRING(512) },
      file_size: { type: INTEGER },
      source: { type: STRING(64), defaultValue: 'upload' },
      parse_status: { type: STRING(32), defaultValue: 'pending' },
      parse_error: { type: TEXT },
      parsed_meta: { type: JSONB, defaultValue: {} },
      tags: { type: JSONB, defaultValue: [] },
      metadata: { type: JSONB, defaultValue: {} },
      upload_user: { type: STRING(100) },
    },
    {
      tableName: 'documents',
    },
  );

  Document.associate = function associate() {
    app.model.Document.hasMany(app.model.GenerationJob, { foreignKey: 'document_id' });
    app.model.Document.hasMany(app.model.TestCase, { foreignKey: 'document_id' });
  };

  return Document;
};
