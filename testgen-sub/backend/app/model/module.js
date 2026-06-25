'use strict';

module.exports = app => {
  const { STRING, INTEGER } = app.Sequelize;

  const Module = app.model.define(
    'module',
    {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: STRING(64), allowNull: false, unique: true },
      name: { type: STRING(100), allowNull: false },
      sort: { type: INTEGER, defaultValue: 0 },
    },
    {
      tableName: 'modules',
      timestamps: false,
    },
  );

  return Module;
};
