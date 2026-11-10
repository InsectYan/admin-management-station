'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  return app.model.define('auto_job_item', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    job_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'cartoon_auto_jobs', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
    shot_id: { type: INTEGER, allowNull: false },
    shot_code: { type: STRING(64), allowNull: false, defaultValue: '' },
    status: { type: STRING(32), allowNull: false, defaultValue: 'pending' },
    reason: { type: TEXT, allowNull: false, defaultValue: '' },
    task_id: { type: INTEGER, allowNull: true },
  }, {
    tableName: 'cartoon_auto_job_items',
    underscored: true,
  });
};
