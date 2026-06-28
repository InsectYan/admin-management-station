/**
 * @file schemaSync.js
 * @description 启动时校验 ORM 模型与数据库差异：执行 init.sql/migrations、Fitness 表 DDL、Sequelize alter、删除孤儿表。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { syncTableColumnsFromInitSql } = require('../../scripts/lib/schema-column-sync');

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
 * @param {string} sql
 * @returns {string}
 */
function stripInsertStatements(sql) {
  return sql
    .split('\n')
    .filter(line => !/^\s*INSERT\s+/i.test(line.trim()))
    .join('\n');
}

/**
 * @param {string} dbDir
 * @returns {string[]}
 */
function loadTablesOrder(dbDir) {
  const orderFile = path.join(dbDir, 'tables-order.json');
  if (!fs.existsSync(orderFile)) return [];
  return JSON.parse(fs.readFileSync(orderFile, 'utf8'));
}

/**
 * @param {string} dbDir
 * @returns {Record<string, { pk: string|string[], type: string }>}
 */
function loadTablesMeta(dbDir) {
  const metaFile = path.join(dbDir, 'tables-meta.json');
  if (!fs.existsSync(metaFile)) return {};
  return JSON.parse(fs.readFileSync(metaFile, 'utf8'));
}

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string} dbDir
 * @param {import('egg').EggLogger} logger
 * @param {{ beforeTables?: boolean, afterTables?: boolean }} scope
 */
async function runSqlBootstrap(sequelize, dbDir, logger, scope = {}) {
  const files = [ path.join(dbDir, 'init.sql') ];
  const migrationsDir = path.join(dbDir, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    fs.readdirSync(migrationsDir)
      .filter(name => name.endsWith('.sql'))
      .sort()
      .forEach(name => {
        const isLate = name.startsWith('003_') || name.startsWith('004_') || name.startsWith('005_');
        if (scope.beforeTables && isLate) return;
        if (scope.afterTables && !isLate) return;
        if (!scope.beforeTables && !scope.afterTables) {
          files.push(path.join(migrationsDir, name));
          return;
        }
        files.push(path.join(migrationsDir, name));
      });
  }

  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    await sequelize.query(sql);
    logger.info('[SchemaSync] Applied %s', path.basename(file));
  }
}

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string} dbDir
 * @param {import('egg').EggLogger} logger
 */
async function runTablesBootstrap(sequelize, dbDir, logger) {
  const tablesDir = path.join(dbDir, 'tables');
  if (!fs.existsSync(tablesDir)) return;

  const order = loadTablesOrder(dbDir);
  const dirs = order.length
    ? order
    : fs.readdirSync(tablesDir).filter(name => fs.statSync(path.join(tablesDir, name)).isDirectory());

  for (const name of dirs) {
    if (name.startsWith('v_')) continue;
    const initFile = path.join(tablesDir, name, 'init.sql');
    if (!fs.existsSync(initFile)) continue;
    const sql = stripInsertStatements(fs.readFileSync(initFile, 'utf8'));
    if (!sql.trim()) continue;
    await sequelize.query(sql);
    logger.info('[SchemaSync] Applied tables/%s/init.sql', name);
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
 * @param {string} dbDir
 * @returns {string[]}
 */
function collectFitnessBaseTableNames(dbDir) {
  const meta = loadTablesMeta(dbDir);
  return Object.keys(meta).filter(name => meta[name].type === 'table');
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
    await runSqlBootstrap(sequelize, dbDir, logger, { beforeTables: true });
    await runTablesBootstrap(sequelize, dbDir, logger);
    const colSync = await syncTableColumnsFromInitSql(sequelize, dbDir, { logger });
    if (colSync.added) {
      logger.info('[SchemaSync] 自动补列 %d 个（%d 表）', colSync.added, colSync.tables);
    }
    await runSqlBootstrap(sequelize, dbDir, logger, { afterTables: true });
  } else {
    logger.warn('[SchemaSync] database/init.sql not found under %s', app.baseDir);
  }

  await sequelize.sync({ alter: true });
  logger.info('[SchemaSync] Sequelize sync (alter) completed');

  const expected = [
    ...collectModelTableNames(app),
    ...(dbDir ? collectFitnessBaseTableNames(dbDir) : []),
  ];
  await dropOrphanTables(sequelize, expected, logger);
  logger.info('[SchemaSync] Completed, model tables=%j', expected);
}

module.exports = {
  syncSchemaOnStartup,
  resolveDatabaseDir,
  collectModelTableNames,
  loadTablesMeta,
  loadTablesOrder,
  stripInsertStatements,
};
