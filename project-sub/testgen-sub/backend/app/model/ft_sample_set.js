'use strict';

module.exports = app => {
  const { INTEGER, STRING, JSONB } = app.Sequelize;
  return app.model.define('ft_sample_set', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(255), allowNull: false },
    tags: { type: JSONB, defaultValue: [] },
    item_id: { type: STRING(64) },
    prefix_pattern: { type: STRING(128) },
    sample_count: { type: INTEGER, defaultValue: 0 },
  }, { tableName: 'ft_sample_set' });
};
