'use strict';

module.exports = app => {
  const { TEXT, INTEGER } = app.Sequelize;
  return app.model.define('cartoon_prompt', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    shot_id: { type: INTEGER, allowNull: false, unique: true },
    positive_zh: { type: TEXT, allowNull: true },
    negative_zh: { type: TEXT, allowNull: true },
  }, { tableName: 'cartoon_prompts' });
};
