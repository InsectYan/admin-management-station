'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  return app.model.define('cartoon_asset', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    kind: { type: STRING(32), allowNull: false, defaultValue: 'character' },
    name: { type: STRING(200), allowNull: false },
    description: { type: TEXT, allowNull: true },
  }, { tableName: 'cartoon_assets' });
};
