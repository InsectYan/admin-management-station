'use strict';

module.exports = app => {
  const { INTEGER, STRING } = app.Sequelize;
  return app.model.define('cartoon_shot_binding', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    shot_id: { type: INTEGER, allowNull: false },
    asset_id: { type: INTEGER, allowNull: false },
    reason: { type: STRING(80), allowNull: false, defaultValue: '' },
  }, { tableName: 'cartoon_shot_bindings' });
};
