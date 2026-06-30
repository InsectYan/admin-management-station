'use strict';

const fs = require('fs');
const path = require('path');
const { stripInsertStatements, loadTablesOrder } = require('../../app/lib/schemaSync');

/**
 * 清空 public schema 下全部对象（表、视图、序列等）
 * @param {import('pg').Client} client
 * @param {string} dbUser
 */
async function dropPublicSchema(client, dbUser) {
  const safeUser = String(dbUser).replace(/"/g, '""');
  console.log('[db] 清空 public schema（DROP CASCADE）…');
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query(`GRANT ALL ON SCHEMA public TO "${safeUser}"`);
  await client.query('GRANT ALL ON SCHEMA public TO public');
}

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string} dbDir
 * @param {string} tableName
 */
async function applyTableDdl(sequelize, dbDir, tableName) {
  const initFile = path.join(dbDir, 'tables', tableName, 'init.sql');
  if (!fs.existsSync(initFile)) {
    throw new Error(`表 ${tableName} 缺少 database/tables/${tableName}/init.sql`);
  }
  const sql = stripInsertStatements(fs.readFileSync(initFile, 'utf8'));
  if (!sql.trim()) {
    throw new Error(`表 ${tableName} 的 init.sql 无 DDL 内容`);
  }
  await sequelize.query(sql);
  console.log(`[db] 已重建 ${tableName.startsWith('v_') ? '视图' : '表'} ${tableName}`);
}

/**
 * @param {import('pg').Client} client
 * @param {string} tableName
 */
async function dropTableOrView(client, tableName) {
  const quoted = `"${tableName.replace(/"/g, '""')}"`;
  if (tableName.startsWith('v_')) {
    await client.query(`DROP VIEW IF EXISTS ${quoted} CASCADE`);
    console.log(`[db] 已删除视图 ${tableName}`);
    return;
  }
  await client.query(`DROP TABLE IF EXISTS ${quoted} CASCADE`);
  console.log(`[db] 已删除表 ${tableName}`);
}

/**
 * @param {string} dbDir
 * @param {string} [targetTable]
 */
function assertKnownTable(dbDir, targetTable) {
  const known = loadTablesOrder(dbDir);
  if (!known.includes(targetTable)) {
    const hint = known.filter(n => !n.startsWith('v_')).slice(0, 8).join(', ');
    throw new Error(`未知表名: ${targetTable}（示例: ${hint}…）`);
  }
}

module.exports = {
  dropPublicSchema,
  applyTableDdl,
  dropTableOrView,
  assertKnownTable,
  loadTablesOrder,
};
