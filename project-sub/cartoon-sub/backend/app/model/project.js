'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  return app.model.define('cartoon_project', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(200), allowNull: false },
    source_novel_id: { type: STRING(64), allowNull: true },
    visual_style: { type: STRING(64), allowNull: false, defaultValue: '' },
    summary: { type: TEXT, allowNull: true },
    status: { type: STRING(32), allowNull: false, defaultValue: 'draft' },
    content_type: { type: STRING(32), allowNull: false, defaultValue: 'ai_comic' },
    package_id: { type: STRING(64), allowNull: true },
    package_version: { type: INTEGER, allowNull: true },
    pin_mode: { type: STRING(16), allowNull: false, defaultValue: 'required' },
    template_id: { type: STRING(64), allowNull: true },
  }, { tableName: 'cartoon_projects' });
};
