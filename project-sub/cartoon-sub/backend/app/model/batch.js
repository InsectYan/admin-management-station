'use strict';

module.exports = app => {
  const { STRING, INTEGER } = app.Sequelize;
  return app.model.define('batch', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'cartoon_projects', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    status: { type: STRING(32), allowNull: false, defaultValue: 'queued' },
    total: { type: INTEGER, allowNull: false, defaultValue: 0 },
    success_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    failed_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    breakpoint_index: { type: INTEGER, allowNull: false, defaultValue: 0 },
    rule_snapshot: { type: app.Sequelize.JSONB, allowNull: false, defaultValue: [] },
  }, {
    tableName: 'cartoon_batches',
    underscored: true,
  });
};
