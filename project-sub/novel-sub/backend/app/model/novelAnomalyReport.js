'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, TEXT, JSONB } = app.Sequelize;

  const NovelAnomalyReport = app.model.define('novel_anomaly_report', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    mode: { type: STRING(20), allowNull: false, defaultValue: 'rough' },
    status: { type: STRING(20), allowNull: false, defaultValue: 'open' },
    summary: { type: TEXT, allowNull: true },
    issue_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    word_floor: { type: INTEGER, allowNull: false, defaultValue: 0 },
    findings_json: { type: JSONB, allowNull: false, defaultValue: [] },
    tasks_json: { type: JSONB, allowNull: false, defaultValue: [] },
  }, {
    tableName: 'novel_anomaly_reports',
    underscored: true,
  });

  NovelAnomalyReport.associate = function associate() {
    app.model.NovelAnomalyReport.belongsTo(app.model.Novel, {
      foreignKey: 'novel_id',
      as: 'novel',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  };

  return NovelAnomalyReport;
};
