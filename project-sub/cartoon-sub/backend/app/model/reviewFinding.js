'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;
  return app.model.define('cartoon_review_finding', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    shot_id: { type: INTEGER, allowNull: true },
    rule_id: { type: INTEGER, allowNull: true },
    level: { type: STRING(16), allowNull: false, defaultValue: 'warning' },
    message: { type: TEXT, allowNull: false, defaultValue: '' },
    node: { type: STRING(32), allowNull: false, defaultValue: 'script' },
    source: { type: STRING(16), allowNull: false, defaultValue: 'model' },
  }, { tableName: 'cartoon_review_findings' });
};
