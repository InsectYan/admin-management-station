'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  return app.model.define('cartoon_asset', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    kind: { type: STRING(32), allowNull: false, defaultValue: 'character' },
    name: { type: STRING(200), allowNull: false },
    description: { type: TEXT, allowNull: true },
    reference_path: { type: STRING(300), allowNull: false, defaultValue: '' },
    voice_key: { type: STRING(80), allowNull: false, defaultValue: '' },
    speech_rate: { type: STRING(32), allowNull: false, defaultValue: '' },
    emotion: { type: STRING(64), allowNull: false, defaultValue: '' },
  }, { tableName: 'cartoon_assets' });
};
