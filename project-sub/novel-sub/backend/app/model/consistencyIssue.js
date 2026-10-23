'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;
  return app.model.define('consistency_issue', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    chapter_id: { type: STRING(80), allowNull: false, defaultValue: '' },
    rule: { type: STRING(64), allowNull: false },
    level: { type: STRING(16), allowNull: false },
    status: { type: STRING(16), allowNull: false, defaultValue: 'open' },
    message: { type: TEXT, allowNull: false },
    source: { type: STRING(16), allowNull: false, defaultValue: 'rule' },
  }, {
    tableName: 'consistency_issues',
    underscored: true,
  });
};
