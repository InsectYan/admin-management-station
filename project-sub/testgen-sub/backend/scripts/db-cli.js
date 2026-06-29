'use strict';

const path = require('path');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');
const { bootstrapFitnessSchema, runViewsBootstrap } = require('./lib/schema-bootstrap');
const {
  buildInsertSql,
  loadSeedTableOrder,
  loadSeedTableMeta,
  assertSeedable,
  extractInsertStatements,
  loadTableColumnNames,
  filterRowsForSeed,
} = require('./lib/fitness-seed-rules');

function loadEnv() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const localEnv = path.join(__dirname, '../../deploy/config/.env.local');
  if (require('fs').existsSync(localEnv)) {
    require('dotenv').config({ path: localEnv, override: false });
  }
}

function pgConfig() {
  return {
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5302),
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: process.env.POSTGRES_DB || 'testgen_db',
  };
}

function pgClient() {
  return new Client(pgConfig());
}

async function syncSchema() {
  loadEnv();
  const sequelize = new Sequelize(
    pgConfig().database,
    pgConfig().user,
    pgConfig().password,
    { ...pgConfig(), dialect: 'postgres', logging: false },
  );
  try {
    await bootstrapFitnessSchema(sequelize, { baseDir: path.join(__dirname, '..') });
    console.log('[db] Schema 同步完成（DDL + Fitness 表 + 运行时表）');
  } finally {
    await sequelize.close();
  }
}

/**
 * @param {string} tablesDir
 * @param {string} tableName
 * @param {import('pg').Client} client
 * @param {Record<string, { pk: string|string[] }>} meta
 */
/**
 * init.sql 种子未写入 scheme 列时，从 data.json / 子类映射表回填 DB
 * @param {import('pg').Client} client
 * @param {string} tablesDir
 */
async function syncItemSchemesAfterSeed(client, tablesDir) {
  const check = assertSeedable(tablesDir, 'test_item_detail');
  if (!check.ok) return { fromDataJson: 0, fromMinorScheme: 0 };

  const rawRows = JSON.parse(require('fs').readFileSync(check.dataFile, 'utf8'));
  let fromDataJson = 0;
  for (const row of rawRows) {
    if (!row.item_id || (!row.scheme_primary_id && !row.validation_primary_id)) continue;
    const res = await client.query(`
      UPDATE test_item_detail SET
        scheme_primary_id = COALESCE(scheme_primary_id, $2),
        scheme_secondary_id = COALESCE(scheme_secondary_id, $3),
        validation_primary_id = COALESCE(validation_primary_id, $4),
        validation_secondary_id = COALESCE(validation_secondary_id, $5),
        sample_execution_note = COALESCE(sample_execution_note, $6),
        scheme_mapping_source = COALESCE(scheme_mapping_source, $7)
      WHERE item_id = $1
        AND (scheme_primary_id IS NULL OR validation_primary_id IS NULL)
    `, [
      row.item_id,
      row.scheme_primary_id ?? null,
      row.scheme_secondary_id ?? null,
      row.validation_primary_id ?? null,
      row.validation_secondary_id ?? null,
      row.sample_execution_note ?? null,
      row.scheme_mapping_source ?? null,
    ]);
    fromDataJson += res.rowCount;
  }

  const minorRes = await client.query(`
    UPDATE test_item_detail t
    SET
      scheme_primary_id = cms.scheme_primary_id,
      scheme_secondary_id = COALESCE(t.scheme_secondary_id, cms.scheme_secondary_id),
      validation_primary_id = cms.validation_primary_id,
      validation_secondary_id = COALESCE(t.validation_secondary_id, cms.validation_secondary_id),
      sample_execution_note = COALESCE(t.sample_execution_note, cms.sample_execution_note),
      scheme_mapping_source = COALESCE(t.scheme_mapping_source, cms.mapping_source)
    FROM test_category_minor_scheme cms
    WHERE t.category_minor_id = cms.category_minor_id
      AND t.scheme_primary_id IS NULL
  `);

  return { fromDataJson, fromMinorScheme: minorRes.rowCount };
}

async function seedTable(tablesDir, tableName, client, meta, { failFast = false } = {}) {
  const check = assertSeedable(tablesDir, tableName);
  if (!check.ok) {
    console.warn(`[skip] ${tableName}: ${check.reason}`);
    return { table: tableName, status: 'skipped' };
  }

  const initSql = require('fs').readFileSync(path.join(check.dir, 'init.sql'), 'utf8');
  const insertFromInit = extractInsertStatements(initSql);

  if (insertFromInit.length) {
    let okCount = 0;
    let failCount = 0;
    for (const sql of insertFromInit) {
      try {
        await client.query(sql);
        okCount += 1;
      } catch (err) {
        failCount += 1;
        if (failFast) throw err;
      }
    }
    if (!okCount && failCount) {
      console.error(`[fail] ${tableName}: 全部 ${failCount} 条 INSERT 失败`);
      return { table: tableName, status: 'fail', count: 0, failed: failCount };
    }
    console.log(`[ok] ${tableName}: ${okCount} inserts from init.sql${failCount ? ` (${failCount} 跳过)` : ''}`);
    return { table: tableName, status: 'ok', count: okCount, failed: failCount, source: 'init.sql' };
  }

  const columnNames = loadTableColumnNames(initSql);
  const rawRows = JSON.parse(require('fs').readFileSync(check.dataFile, 'utf8'));
  if (!Array.isArray(rawRows) || !rawRows.length) {
    console.log(`[skip] ${tableName}: data.json 为空且无 INSERT`);
    return { table: tableName, status: 'empty' };
  }

  const pk = meta[tableName]?.pk;
  if (!pk) {
    throw new Error(`${tableName}: tables-meta.json 未配置主键`);
  }

  const rows = filterRowsForSeed(rawRows, columnNames);
  const statements = buildInsertSql(tableName, rows, pk);
  let okCount = 0;
  let failCount = 0;
  let firstError = '';
  for (const sql of statements) {
    try {
      await client.query(sql);
      okCount += 1;
    } catch (err) {
      failCount += 1;
      if (!firstError) firstError = err.message;
      if (failFast) throw err;
    }
  }
  if (!okCount && failCount) {
    console.error(`[fail] ${tableName}: 全部 ${failCount} 条 INSERT 失败${firstError ? ` — ${firstError}` : ''}`);
    return { table: tableName, status: 'fail', count: 0, failed: failCount };
  }
  console.log(`[ok] ${tableName}: ${okCount} rows from data.json${failCount ? ` (${failCount} 跳过)` : ''}`);
  return { table: tableName, status: 'ok', count: okCount, failed: failCount, source: 'data.json' };
}

/**
 * @param {string} [targetTable]
 * @param {{ syncFirst?: boolean }} [opts]
 */
async function seedData(targetTable, opts = {}) {
  loadEnv();
  const syncFirst = opts.syncFirst !== false;

  if (syncFirst) {
    console.log('[db] 注入前先同步 Schema…');
    await syncSchema();
  }

  try {
    const { resolveAll } = require('./resolve-item-schemes.js');
    const r = resolveAll();
    console.log(`[db] 方案解析: 补主 TS/VS ${r.filledPrimary} 处, 子类映射 ${r.minorSchemes} 条`);
  } catch (err) {
    console.warn('[db] 方案解析跳过:', err.message);
  }

  try {
    const { enrichAll } = require('./enrich-data-json-fk.js');
    const n = enrichAll();
    if (n) console.log(`[db] data.json 已补充 ${n} 表的中文名字段`);
  } catch (err) {
    console.warn('[db] data.json FK 名称 enrich 跳过:', err.message);
  }

  const dbDir = path.join(__dirname, '../../database');
  const tablesDir = path.join(dbDir, 'tables');
  const order = loadSeedTableOrder(dbDir);
  const meta = loadSeedTableMeta(dbDir);
  const tables = targetTable ? [ targetTable ] : order;

  const client = pgClient();
  await client.connect();
  const results = [];

  for (const tableName of tables) {
    try {
      results.push(await seedTable(tablesDir, tableName, client, meta, { failFast: !!targetTable }));
    } catch (err) {
      console.error(`[fail] ${tableName}:`, err.message);
      results.push({ table: tableName, status: 'fail', error: err.message });
      if (!targetTable) continue;
      await client.end();
      process.exit(1);
    }
  }

  const failed = results.filter(r => r.status === 'fail').length;
  const ok = results.filter(r => r.status === 'ok').length;
  const partial = results.filter(r => r.status === 'ok' && r.failed > 0).length;
  console.log(`\n[db] 数据注入: ${results.length} 表, 成功 ${ok}, 失败 ${failed}${partial ? `, 部分跳过 ${partial} 表` : ''}`);
  if (failed) {
    await client.end();
    process.exit(1);
  }

  try {
    const schemeSync = await syncItemSchemesAfterSeed(client, tablesDir);
    if (schemeSync.fromDataJson || schemeSync.fromMinorScheme) {
      console.log(
        `[db] 用例方案回填: data.json ${schemeSync.fromDataJson} 条, 子类映射 ${schemeSync.fromMinorScheme} 条`,
      );
    }
  } catch (err) {
    console.warn('[db] 用例方案回填跳过:', err.message);
  }

  await client.end();

  console.log('[db] 创建/更新分析视图…');
  const sequelize = new Sequelize(
    pgConfig().database,
    pgConfig().user,
    pgConfig().password,
    { ...pgConfig(), dialect: 'postgres', logging: false },
  );
  try {
    const dbDir = path.join(__dirname, '../../database');
    await runViewsBootstrap(sequelize, dbDir, console);
  } finally {
    await sequelize.close();
  }
  console.log('[db] 全部完成');
}

async function main() {
  const cmd = process.argv[2] || 'seed';
  const arg = process.argv[3];

  switch (cmd) {
    case 'sync':
      await syncSchema();
      break;
    case 'seed':
      await seedData(arg || undefined, { syncFirst: true });
      break;
    case 'all':
    case 'full':
      await seedData(undefined, { syncFirst: true });
      break;
    default:
      console.error(`用法: node db-cli.js <sync|seed [表名]|all>`);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { syncSchema, seedData };
