'use strict';

const fs = require('fs');
const path = require('path');

const {
  resolveDatabaseDir,
  stripInsertStatements,
  loadTablesOrder,
  isLateMigration,
  isPostSeedMigration,
} = require('../../app/lib/schemaSync');
const { syncTableColumnsFromInitSql } = require('./schema-column-sync');

async function runSqlBootstrap(sequelize, dbDir, logger, scope = {}) {
  const files = scope.postSeed ? [] : [ path.join(dbDir, 'init.sql') ];
  const migrationsDir = path.join(dbDir, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    fs.readdirSync(migrationsDir)
      .filter(name => name.endsWith('.sql'))
      .sort()
      .forEach(name => {
        const isLate = isLateMigration(name);
        const isPostSeed = isPostSeedMigration(name);
        if (scope.beforeTables && isLate) return;
        if (scope.afterTables && (!isLate || isPostSeed)) return;
        if (scope.postSeed && !isPostSeed) return;
        files.push(path.join(migrationsDir, name));
      });
  }
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    await sequelize.query(sql);
    logger.info('[SchemaSync] Applied %s', path.basename(file));
  }
}

async function runTablesBootstrap(sequelize, dbDir, logger, { includeViews = false } = {}) {
  const tablesDir = path.join(dbDir, 'tables');
  if (!fs.existsSync(tablesDir)) return;
  for (const name of loadTablesOrder(dbDir)) {
    if (!includeViews && name.startsWith('v_')) continue;
    const initFile = path.join(tablesDir, name, 'init.sql');
    if (!fs.existsSync(initFile)) continue;
    const sql = stripInsertStatements(fs.readFileSync(initFile, 'utf8'));
    if (!sql.trim()) continue;
    await sequelize.query(sql);
    logger.info('[SchemaSync] Applied tables/%s/init.sql (DDL only)', name);
  }
}

async function runViewsBootstrap(sequelize, dbDir, logger) {
  const tablesDir = path.join(dbDir, 'tables');
  if (!fs.existsSync(tablesDir)) return;

  const orderFile = path.join(dbDir, 'views-order.json');
  let viewNames = [];
  if (fs.existsSync(orderFile)) {
    viewNames = JSON.parse(fs.readFileSync(orderFile, 'utf8'));
  } else {
    viewNames = fs.readdirSync(tablesDir)
      .filter(name => name.startsWith('v_') && fs.statSync(path.join(tablesDir, name)).isDirectory())
      .sort();
  }

  let applied = 0;
  let failed = 0;
  for (const name of viewNames) {
    const initFile = path.join(tablesDir, name, 'init.sql');
    if (!fs.existsSync(initFile)) {
      logger.warn('[SchemaSync] View %s skipped: init.sql 不存在', name);
      failed += 1;
      continue;
    }
    const sql = stripInsertStatements(fs.readFileSync(initFile, 'utf8'));
    if (!sql.trim()) continue;
    try {
      await sequelize.query(sql);
      logger.info('[SchemaSync] Applied view %s', name);
      applied += 1;
    } catch (err) {
      logger.warn('[SchemaSync] View %s failed: %s', name, err.message);
      failed += 1;
    }
  }
  if (viewNames.length && !applied) {
    logger.warn('[SchemaSync] 未成功创建任何分析视图（%d 失败）', failed);
  }
}

/** @param {string} dbDir @returns {string[]} */
function loadViewsOrder(dbDir) {
  const orderFile = path.join(dbDir, 'views-order.json');
  if (fs.existsSync(orderFile)) {
    return JSON.parse(fs.readFileSync(orderFile, 'utf8'));
  }
  const tablesDir = path.join(dbDir, 'tables');
  if (!fs.existsSync(tablesDir)) return [];
  return fs.readdirSync(tablesDir)
    .filter(name => name.startsWith('v_') && fs.statSync(path.join(tablesDir, name)).isDirectory())
    .sort();
}

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {{ baseDir?: string, logger?: Console }} [opts]
 */
async function bootstrapFitnessSchema(sequelize, opts = {}) {
  const baseDir = opts.baseDir || path.join(__dirname, '../..');
  const logger = opts.logger || console;
  const dbDir = resolveDatabaseDir({ baseDir });
  if (!dbDir) {
    throw new Error('database 目录未找到');
  }
  await runSqlBootstrap(sequelize, dbDir, logger, { beforeTables: true });
  await runTablesBootstrap(sequelize, dbDir, logger, { includeViews: false });
  const colSync = await syncTableColumnsFromInitSql(sequelize, dbDir, { logger });
  if (colSync.added) {
    logger.info('[SchemaSync] 自动补列 %d 个（%d 表）', colSync.added, colSync.tables);
  }
  await runSqlBootstrap(sequelize, dbDir, logger, { afterTables: true });
  return dbDir;
}

/** 依赖 seed 数据的 migrations（009+），须在 data 注入后执行 */
async function runPostSeedMigrations(sequelize, dbDir, logger = console) {
  await runSqlBootstrap(sequelize, dbDir, logger, { postSeed: true });
}

module.exports = {
  bootstrapFitnessSchema,
  runSqlBootstrap,
  runTablesBootstrap,
  runViewsBootstrap,
  runPostSeedMigrations,
  loadViewsOrder,
};
