/**
 * @file schemaSync.js
 * @description 启动时校验 ORM 模型与数据库差异：执行 init.sql/migrations、Sequelize alter、删除孤儿表。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SYSTEM_TABLES = new Set([
  'schema_migrations',
  'SequelizeMeta',
  'spatial_ref_sys',
]);

/**
 * @param {import('egg').Application} app
 * @returns {string|null}
 */
function resolveDatabaseDir(app) {
  const candidates = [
    path.join(app.baseDir, '../database'),
    path.join(app.baseDir, 'database'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'init.sql'))) return dir;
  }
  return null;
}

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string} dbDir
 * @param {import('egg').EggLogger} logger
 */
async function runSqlBootstrap(sequelize, dbDir, logger) {
  const files = [ path.join(dbDir, 'init.sql') ];
  const migrationsDir = path.join(dbDir, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    fs.readdirSync(migrationsDir)
      .filter(name => name.endsWith('.sql'))
      .sort()
      .forEach(name => files.push(path.join(migrationsDir, name)));
  }

  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    await sequelize.query(sql);
    logger.info('[SchemaSync] Applied %s', path.basename(file));
  }
}

/**
 * @param {import('egg').Application} app
 * @returns {string[]}
 */
function collectModelTableNames(app) {
  if (!app.model?.models) return [];
  return Object.values(app.model.models).map(model => {
    const tableName = model.getTableName();
    return typeof tableName === 'string' ? tableName : tableName.tableName;
  });
}

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {Promise<string[]>}
 */
async function listUserTables(sequelize) {
  const dialect = sequelize.getDialect();
  if (dialect === 'postgres') {
    const [ rows ] = await sequelize.query(`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    return rows.map(r => r.name);
  }
  const [ rows ] = await sequelize.query(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `);
  return rows.map(r => r.name);
}

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string[]} expectedTables
 * @param {import('egg').EggLogger} logger
 */
async function dropOrphanTables(sequelize, expectedTables, logger) {
  const expected = new Set(expectedTables);
  const dbTables = await listUserTables(sequelize);
  const dialect = sequelize.getDialect();

  for (const table of dbTables) {
    if (expected.has(table) || SYSTEM_TABLES.has(table)) continue;
    const dropSql = dialect === 'postgres'
      ? `DROP TABLE IF EXISTS "${table}" CASCADE`
      : `DROP TABLE IF EXISTS "${table}"`;
    await sequelize.query(dropSql);
    logger.warn('[SchemaSync] Dropped orphan table: %s', table);
  }
}

/**
 * @param {import('egg').Application} app
 */
async function syncSchemaOnStartup(app) {
  const logger = app.logger;
  const sequelize = app.model;
  if (!sequelize) {
    logger.warn('[SchemaSync] Sequelize unavailable, skip');
    return;
  }

  const dbDir = resolveDatabaseDir(app);
  if (dbDir) {
    await runSqlBootstrap(sequelize, dbDir, logger);
  } else {
    logger.warn('[SchemaSync] database/init.sql not found under %s', app.baseDir);
  }

  await sequelize.sync({ alter: true });
  logger.info('[SchemaSync] Sequelize sync (alter) completed');

  const expected = collectModelTableNames(app);
  await dropOrphanTables(sequelize, expected, logger);
  logger.info('[SchemaSync] Completed, model tables=%j', expected);
}

module.exports = {
  syncSchemaOnStartup,
  resolveDatabaseDir,
  collectModelTableNames,
};
