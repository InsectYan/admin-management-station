'use strict';

/**
 * 为 database/tables 下所有主表 init.sql / data.json 批量添加 project_code = fitness-agent
 */
const fs = require('fs');
const path = require('path');

const PROJECT_CODE = 'fitness-agent';
const SKIP = new Set([ 'test_project', 'v_' ]);
const tablesDir = path.join(__dirname, '../../database/tables');
const orderFile = path.join(__dirname, '../../database/tables-order.json');
const metaFile = path.join(__dirname, '../../database/tables-meta.json');

const order = JSON.parse(fs.readFileSync(orderFile, 'utf8')).filter(n => !n.startsWith('v_'));
const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));

const COL_DEF = "  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',";

function patchInitSql(filePath, tableName) {
  let sql = fs.readFileSync(filePath, 'utf8');
  if (sql.includes('project_code')) return false;

  const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS \w+ \(\s*\n/);
  if (!createMatch) {
    console.warn(`[skip init] ${tableName}: no CREATE TABLE`);
    return false;
  }
  const insertAt = createMatch.index + createMatch[0].length;
  sql = sql.slice(0, insertAt) + COL_DEF + '\n' + sql.slice(insertAt);
  fs.writeFileSync(filePath, sql, 'utf8');
  return true;
}

function patchDataJson(filePath) {
  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(rows) || !rows.length) return false;
  let changed = false;
  for (const row of rows) {
    if (row.project_code === PROJECT_CODE) continue;
    row.project_code = PROJECT_CODE;
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2) + '\n', 'utf8');
  }
  return changed;
}

let initCount = 0;
let dataCount = 0;

for (const tableName of order) {
  if (SKIP.has(tableName) || tableName.startsWith('v_')) continue;
  const dir = path.join(tablesDir, tableName);
  const initFile = path.join(dir, 'init.sql');
  const dataFile = path.join(dir, 'data.json');
  if (fs.existsSync(initFile) && patchInitSql(initFile, tableName)) initCount += 1;
  if (fs.existsSync(dataFile) && patchDataJson(dataFile)) dataCount += 1;
}

if (!meta.test_project) {
  meta.test_project = { pk: 'project_code', type: 'table' };
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n', 'utf8');
}

if (!order.includes('test_project')) {
  order.unshift('test_project');
  fs.writeFileSync(orderFile, JSON.stringify(order, null, 2) + '\n', 'utf8');
}

console.log(`Patched init.sql: ${initCount}, data.json: ${dataCount}`);
