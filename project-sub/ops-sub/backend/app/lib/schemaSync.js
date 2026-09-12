'use strict';

const fs = require('fs');
const path = require('path');

const SYSTEM_TABLES = new Set([
  'schema_migrations',
  'SequelizeMeta',
  'spatial_ref_sys',
]);

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

function collectModelTableNames(app) {
  if (!app.model?.models) return [];
  return Object.values(app.model.models).map(model => {
    const tableName = model.getTableName();
    return typeof tableName === 'string' ? tableName : tableName.tableName;
  });
}

async function listUserTables(sequelize) {
  const [ rows ] = await sequelize.query(`
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  return rows.map(r => r.name);
}

async function dropOrphanTables(sequelize, expectedTables, logger) {
  const expected = new Set(expectedTables);
  const dbTables = await listUserTables(sequelize);
  for (const table of dbTables) {
    if (expected.has(table) || SYSTEM_TABLES.has(table)) continue;
    await sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    logger.warn('[SchemaSync] Dropped orphan table: %s', table);
  }
}

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
  logger.info('[SchemaSync] Sequelize sync completed');

  await dropOrphanTables(sequelize, collectModelTableNames(app), logger);

  const ctx = app.createAnonymousContext();
  const seeded = await ctx.service.project.seedIfEmpty();
  if (seeded) logger.info('[SchemaSync] inserted %d seed projects', seeded);
}

module.exports = { syncSchemaOnStartup };
