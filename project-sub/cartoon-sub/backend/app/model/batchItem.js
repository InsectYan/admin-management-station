'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  return app.model.define('batch_item', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    batch_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'cartoon_batches', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
    title: { type: STRING(200), allowNull: false, defaultValue: '' },
    body: { type: TEXT, allowNull: false, defaultValue: '' },
    status: { type: STRING(32), allowNull: false, defaultValue: 'queued' },
    error_message: { type: TEXT, allowNull: false, defaultValue: '' },
  }, {
    tableName: 'cartoon_batch_items',
    underscored: true,
  });
};
