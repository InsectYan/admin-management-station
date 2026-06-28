'use strict';

/**
 * Fitness 数据注入规则（对齐 fitness-agent-test-docs/数据库详细表/_scripts/generate-all-tables.mjs）
 * - sqlVal：布尔 / 数字 / JSONB 数组 / 字符串转义
 * - INSERT … ON CONFLICT (pk) DO NOTHING
 * - 注入顺序：tables-order.json（与 init_all.sql 一致，不含视图）
 */

const fs = require('fs');
const path = require('path');
const { parseCreateTable } = require('./schema-column-sync');

/** @param {string} initSql */
function loadTableColumnNames(initSql) {
  const parsed = parseCreateTable(initSql);
  if (!parsed) return null;
  return new Set(parsed.columns.map(c => c.name));
}

/**
 * 去掉 data.json 中 enrich 写入的 *_name 等展示字段，只保留表列
 * @param {Record<string, unknown>[]} rows
 * @param {Set<string>|null} columnNames
 */
function filterRowsForSeed(rows, columnNames) {
  if (!columnNames) return rows;
  return rows.map(row => {
    const next = {};
    for (const [ key, val ] of Object.entries(row)) {
      if (columnNames.has(key)) next[key] = val;
    }
    return next;
  });
}

/** @param {unknown} v */
function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * @param {string} tableName
 * @param {Record<string, unknown>[]} rows
 * @param {string|string[]} pk
 */
function buildInsertSql(tableName, rows, pk) {
  if (!rows.length) return [];
  const pkCols = Array.isArray(pk) ? pk : [ pk ];
  const statements = [];
  for (const row of rows) {
    const cols = Object.keys(row);
    const vals = cols.map(c => sqlVal(row[c]));
    statements.push(
      `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(', ')}) `
      + `VALUES (${vals.join(', ')}) `
      + `ON CONFLICT (${pkCols.map(c => `"${c}"`).join(', ')}) DO NOTHING`,
    );
  }
  return statements;
}

/**
 * @param {string} dbDir
 * @returns {string[]}
 */
function loadSeedTableOrder(dbDir) {
  const orderFile = path.join(dbDir, 'tables-order.json');
  if (!fs.existsSync(orderFile)) return [];
  return JSON.parse(fs.readFileSync(orderFile, 'utf8')).filter(name => !name.startsWith('v_'));
}

/**
 * @param {string} dbDir
 */
function loadSeedTableMeta(dbDir) {
  const metaFile = path.join(dbDir, 'tables-meta.json');
  if (!fs.existsSync(metaFile)) return {};
  return JSON.parse(fs.readFileSync(metaFile, 'utf8'));
}

/**
 * @param {string} tablesDir
 * @param {string} tableName
 */
function assertSeedable(tablesDir, tableName) {
  const dir = path.join(tablesDir, tableName);
  const initFile = path.join(dir, 'init.sql');
  const dataFile = path.join(dir, 'data.json');
  if (!fs.existsSync(initFile) || !fs.existsSync(dataFile)) {
    return { ok: false, reason: '缺少 init.sql 或 data.json（结构须对齐 arch_reference/）' };
  }
  return { ok: true, dir, dataFile };
}

/**
 * 从 init.sql 提取 INSERT（与 generate-all-tables.mjs 输出一致）
 * @param {string} initSql
 * @returns {string[]}
 */
function extractInsertStatements(initSql) {
  return initSql
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^INSERT\s+/i.test(line));
}

module.exports = {
  sqlVal,
  buildInsertSql,
  loadSeedTableOrder,
  loadSeedTableMeta,
  assertSeedable,
  extractInsertStatements,
  loadTableColumnNames,
  filterRowsForSeed,
};
