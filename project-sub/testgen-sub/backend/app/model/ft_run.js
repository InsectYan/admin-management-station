'use strict';

module.exports = app => {
  const { INTEGER, STRING, JSONB, DATE } = app.Sequelize;
  return app.model.define('ft_run', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    item_id: { type: STRING(64), allowNull: false },
    run_config_id: { type: INTEGER },
    env_id: { type: INTEGER },
    scheme_id: { type: STRING(16), allowNull: false },
    validation_id: { type: STRING(20) },
    status: { type: STRING(32), defaultValue: 'pending' },
    progress: { type: JSONB, defaultValue: {} },
    verdict: { type: STRING(16) },
    started_at: { type: DATE },
    finished_at: { type: DATE },
  }, { tableName: 'ft_run' });
};
