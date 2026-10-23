'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, BOOLEAN } = app.Sequelize;
  return app.model.define('rule', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    content_type: { type: STRING(32), allowNull: false },
    kind: { type: STRING(32), allowNull: false },
    name: { type: STRING(120), allowNull: false },
    body: { type: TEXT, allowNull: false, defaultValue: '' },
    cost_cap: { type: INTEGER, allowNull: true },
    enabled: { type: BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'cartoon_rules',
    underscored: true,
  });
};
