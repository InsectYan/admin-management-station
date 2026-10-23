'use strict';

module.exports = app => {
  const { TEXT, INTEGER } = app.Sequelize;
  return app.model.define('type_panel', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: {
      type: INTEGER,
      allowNull: false,
      unique: true,
      references: { model: 'cartoon_projects', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    conflict: { type: TEXT, allowNull: false, defaultValue: '' },
    twist: { type: TEXT, allowNull: false, defaultValue: '' },
    rhythm: { type: TEXT, allowNull: false, defaultValue: '' },
    branches: { type: TEXT, allowNull: false, defaultValue: '' },
    product_note: { type: TEXT, allowNull: false, defaultValue: '' },
    selling_points: { type: TEXT, allowNull: false, defaultValue: '' },
    comparison: { type: TEXT, allowNull: false, defaultValue: '' },
  }, {
    tableName: 'cartoon_type_panels',
    underscored: true,
  });
};
