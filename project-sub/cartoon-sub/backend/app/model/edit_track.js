'use strict';

module.exports = app => {
  const { STRING, INTEGER, DECIMAL, BOOLEAN } = app.Sequelize;
  return app.model.define('cartoon_edit_track', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    edit_id: { type: INTEGER, allowNull: false },
    kind: { type: STRING(32), allowNull: false },
    volume: { type: DECIMAL(4, 2), allowNull: false, defaultValue: 1 },
    muted: { type: BOOLEAN, allowNull: false, defaultValue: false },
  }, { tableName: 'cartoon_edit_tracks' });
};
