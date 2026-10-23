'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;
  const CopyBlock = app.model.define('copy_block', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_id: {
      type: INTEGER,
      allowNull: false,
      references: { model: 'cartoon_projects', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 1 },
    title: { type: STRING(200), allowNull: false, defaultValue: '' },
    body: { type: TEXT, allowNull: false, defaultValue: '' },
  }, {
    tableName: 'cartoon_copy_blocks',
    underscored: true,
  });
  CopyBlock.associate = function associate() {
    app.model.CopyBlock.belongsTo(app.model.Project, { foreignKey: 'project_id' });
  };
  return CopyBlock;
};
