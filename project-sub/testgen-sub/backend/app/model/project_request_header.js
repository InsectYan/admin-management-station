'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, SMALLINT } = app.Sequelize;
  return app.model.define('project_request_header', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    project_code: { type: STRING(64), allowNull: false },
    header_key: { type: STRING(256), allowNull: false },
    header_value: { type: TEXT },
    sort_order: { type: SMALLINT, defaultValue: 0 },
  }, { tableName: 'project_request_header' });
};
