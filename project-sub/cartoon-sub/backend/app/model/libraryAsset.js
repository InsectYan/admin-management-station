'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, BOOLEAN } = app.Sequelize;
  return app.model.define('cartoon_library_asset', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    kind: { type: STRING(32), allowNull: false, defaultValue: 'character' },
    name: { type: STRING(200), allowNull: false },
    description: { type: TEXT, allowNull: false, defaultValue: '' },
    revision: { type: INTEGER, allowNull: false, defaultValue: 1 },
    disabled: { type: BOOLEAN, allowNull: false, defaultValue: false },
  }, { tableName: 'cartoon_library_assets' });
};
