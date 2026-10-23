'use strict';

module.exports = app => {
  const { STRING, INTEGER, BOOLEAN } = app.Sequelize;
  return app.model.define('pipeline_node', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    content_type: { type: STRING(32), allowNull: false },
    node_key: { type: STRING(64), allowNull: false },
    title: { type: STRING(80), allowNull: false, defaultValue: '' },
    kind: { type: STRING(16), allowNull: false, defaultValue: 'custom' },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
    enabled: { type: BOOLEAN, allowNull: false, defaultValue: true },
    skill_name: { type: STRING(80), allowNull: false, defaultValue: '' },
  }, {
    tableName: 'cartoon_pipeline_nodes',
    underscored: true,
  });
};
