'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  return app.model.define('enum_item', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    catalog: { type: STRING(32), allowNull: false },
    code: { type: STRING(80), allowNull: false },
    name: { type: STRING(120), allowNull: false, defaultValue: '' },
    group_name: { type: STRING(80), allowNull: false, defaultValue: '' },
    note: { type: TEXT, allowNull: false, defaultValue: '' },
    prompt: { type: TEXT, allowNull: false, defaultValue: '' },
    bind: { type: STRING(16), allowNull: false, defaultValue: '' },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'cartoon_enums',
    indexes: [
      { unique: true, fields: [ 'catalog', 'code' ] },
    ],
  });
};
