'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, DATE } = app.Sequelize;
  return app.model.define('cartoon_refmod', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    kind: { type: STRING(16), allowNull: false, defaultValue: 'character' },
    name: { type: STRING(200), allowNull: false },
    images: { type: TEXT, allowNull: false, defaultValue: '[]' },
    created_at: { type: DATE, allowNull: false },
  }, {
    tableName: 'cartoon_refmods',
    timestamps: false,
  });
};
