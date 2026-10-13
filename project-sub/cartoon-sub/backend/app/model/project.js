'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  return app.model.define('cartoon_project', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(200), allowNull: false },
    source_novel_id: { type: STRING(64), allowNull: true },
    summary: { type: TEXT, allowNull: true },
    status: { type: STRING(32), allowNull: false, defaultValue: 'draft' },
  }, { tableName: 'cartoon_projects' });
};
