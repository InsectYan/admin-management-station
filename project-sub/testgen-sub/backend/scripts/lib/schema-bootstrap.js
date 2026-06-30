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
  for (const name of loadTablesOrder(dbDir)) {
    if (!name.startsWith('v_')) continue;
    const initFile = path.join(tablesDir, name, 'init.sql');
    if (!fs.existsSync(initFile)) continue;
    const sql = stripInsertStatements(fs.readFileSync(initFile, 'utf8'));
    if (!sql.trim()) continue;
    try {
      await sequelize.query(sql);
      logger.info('[SchemaSync] Applied view %s', name);
    } catch (err) {
      logger.warn('[SchemaSync] View %s skipped: %s', name, err.message);
    }
  }
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
};
