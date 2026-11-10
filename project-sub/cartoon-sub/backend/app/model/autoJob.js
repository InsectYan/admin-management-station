'use strict';

module.exports = app => {
  const { STRING, INTEGER } = app.Sequelize;
  return app.model.define('auto_job', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'cartoon_projects', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    status: { type: STRING(32), allowNull: false, defaultValue: 'running' },
    total: { type: INTEGER, allowNull: false, defaultValue: 0 },
    done: { type: INTEGER, allowNull: false, defaultValue: 0 },
    success_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    failed_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    skipped_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'cartoon_auto_jobs',
    underscored: true,
  });
};
