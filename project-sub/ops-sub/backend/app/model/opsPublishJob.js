'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, DATE } = app.Sequelize;
  const PublishJob = app.model.define('ops_publish_job', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    channel_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'ops_channels', key: 'id' },
      onDelete: 'CASCADE',
    },
    source_app: { type: STRING(32), allowNull: false },
    source_id: { type: STRING(80), allowNull: false },
    version: { type: INTEGER, allowNull: true },
    scheduled_at: { type: DATE, allowNull: false },
    status: { type: STRING(32), allowNull: false, defaultValue: 'scheduled' },
    reason: { type: TEXT, allowNull: false, defaultValue: '' },
    play_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    finish_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
    conversion_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'ops_publish_jobs',
  });
  return PublishJob;
};
