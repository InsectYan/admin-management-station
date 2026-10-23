'use strict';

module.exports = (app) => {
  const { INTEGER, STRING, JSONB, DATE } = app.Sequelize;
  return app.model.define('story_package', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    novel_id: { type: INTEGER, allowNull: false },
    package_id: { type: STRING(64), allowNull: false },
    version: { type: INTEGER, allowNull: false },
    snapshot_json: { type: JSONB, allowNull: false },
    published_at: { type: DATE, allowNull: false },
  }, {
    tableName: 'story_packages',
    underscored: true,
  });
};
