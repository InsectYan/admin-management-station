'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT, JSONB } = app.Sequelize;
  const NovelGenerationRecord = app.model.define('novel_generation_record', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    kind: { type: STRING(32), allowNull: false },
    action: { type: STRING(32), allowNull: false, defaultValue: 'adjust' },
    title: { type: STRING(200), allowNull: false, defaultValue: '' },
    summary: { type: TEXT, allowNull: false, defaultValue: '' },
    diff_json: { type: JSONB, allowNull: false, defaultValue: [] },
  }, {
    tableName: 'novel_generation_records',
    underscored: true,
  });

  NovelGenerationRecord.associate = function associate() {
    app.model.NovelGenerationRecord.belongsTo(app.model.Novel, {
      foreignKey: 'novel_id',
      as: 'novel',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  };

  return NovelGenerationRecord;
};
