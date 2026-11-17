'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  return app.model.define('cartoon_prompt_trace', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: INTEGER, allowNull: false },
    shot_id: { type: INTEGER, allowNull: false },
    part: { type: STRING(16), allowNull: false },
    step: { type: INTEGER, allowNull: false, defaultValue: 0 },
    title: { type: STRING(32), allowNull: false, defaultValue: '' },
    skill: { type: STRING(64), allowNull: false, defaultValue: '' },
    input_text: { type: TEXT, allowNull: false, defaultValue: '' },
    output_text: { type: TEXT, allowNull: false, defaultValue: '' },
  }, { tableName: 'cartoon_prompt_traces' });
};
