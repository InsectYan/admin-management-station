'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT } = app.Sequelize;

  const UpdatePace = app.model.define('update_pace', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(50), allowNull: false, unique: true },
    description: { type: TEXT, allowNull: true },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'update_paces',
    underscored: true,
  });

  return UpdatePace;
};
