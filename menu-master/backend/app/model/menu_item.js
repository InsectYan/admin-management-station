'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;

  const MenuItem = app.model.define(
    'menu_item',
    {
      id: {
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: STRING(100),
        allowNull: false,
      },
      parent_id: {
        type: INTEGER,
        allowNull: true,
      },
      route_prefix: {
        type: STRING(50),
        allowNull: false,
      },
      microapp_name: {
        type: STRING(50),
        allowNull: false,
      },
      status: {
        type: STRING(20),
        defaultValue: 'enabled',
      },
      order: {
        type: INTEGER,
        defaultValue: 0,
        field: 'order',
      },
      icon: {
        type: STRING(200),
        allowNull: true,
      },
      created_at: DATE,
      updated_at: DATE,
    },
    {
      tableName: 'menu_items',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  MenuItem.associate = function associate() {
    MenuItem.hasMany(MenuItem, { as: 'children', foreignKey: 'parent_id' });
    MenuItem.belongsTo(MenuItem, { as: 'parent', foreignKey: 'parent_id' });
  };

  return MenuItem;
};
