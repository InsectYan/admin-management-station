'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, JSONB, DATE, BOOLEAN } = app.Sequelize;
  return app.model.define('cartoon_import', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    source_novel_id: { type: STRING(64), allowNull: true },
    chapter_title: { type: STRING(200), allowNull: true },
    body: { type: TEXT, allowNull: false },
    characters: { type: JSONB, allowNull: false, defaultValue: [] },
    script_data: { type: JSONB, allowNull: true },
    deleted_at: { type: DATE, allowNull: true },
    package_id: { type: STRING(64), allowNull: true },
    package_version: { type: INTEGER, allowNull: true },
    chapter_id: { type: STRING(80), allowNull: true },
    body_hash: { type: STRING(64), allowNull: true },
    legacy_unpinned: { type: BOOLEAN, allowNull: false, defaultValue: false },
    overridden_fields: { type: JSONB, allowNull: false, defaultValue: [] },
    upstream_removed: { type: BOOLEAN, allowNull: false, defaultValue: false },
  }, { tableName: 'cartoon_imports' });
};
