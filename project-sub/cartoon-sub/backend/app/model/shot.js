'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  return app.model.define('cartoon_shot', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
    shot_size: { type: STRING(32), allowNull: true },
    camera_move: { type: STRING(32), allowNull: true },
    description: { type: TEXT, allowNull: true },
  }, { tableName: 'cartoon_shots' });
};
