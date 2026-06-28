'use strict';

module.exports = app => {
  const { INTEGER, JSONB } = app.Sequelize;
  return app.model.define('ft_sample_item', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    sample_set_id: { type: INTEGER, allowNull: false },
    input_data: { type: JSONB, defaultValue: {} },
    expected_data: { type: JSONB },
    metadata: { type: JSONB, defaultValue: {} },
    sort_order: { type: INTEGER, defaultValue: 0 },
  }, { tableName: 'ft_sample_item', updatedAt: false });
};
