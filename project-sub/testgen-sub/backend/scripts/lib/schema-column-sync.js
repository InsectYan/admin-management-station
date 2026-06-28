'use strict';

const fs = require('fs');
const path = require('path');

function loadTablesOrder(dbDir) {
  const orderFile = path.join(dbDir, 'tables-order.json');
  if (!fs.existsSync(orderFile)) return [];
  return JSON.parse(fs.readFileSync(orderFile, 'utf8'));
}

/**
 * 从 CREATE TABLE 语句解析列定义（不含 CONSTRAINT / INDEX）
 * @param {string} sql
 * @returns {{ tableName: string, columns: { name: string, typeDef: string }[] } | null}
 */
function parseCreateTable(sql) {
  const m = sql.match(/CREATE TABLE IF NOT EXISTS\s+"?(\w+)"?\s*\(([\s\S]*?)\)\s*;/i);
  if (!m) return null;

  const tableName = m[1];
  const columns = [];
  const chunks = splitCreateTableBody(m[2]);

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const upper = trimmed.toUpperCase();
    if (
      upper.startsWith('CONSTRAINT ')
      || upper.startsWith('PRIMARY KEY')
      || upper.startsWith('UNIQUE ')
      || upper.startsWith('FOREIGN KEY')
      || upper.startsWith('CHECK ')
    ) continue;

    const colMatch = trimmed.match(/^"?(\w+)"?\s+([\s\S]+)$/);
    if (!colMatch) continue;

    let typeDef = colMatch[2].trim();
    typeDef = typeDef.replace(/\s+REFERENCES\s+[\s\S]+$/i, '').trim();
    typeDef = typeDef.replace(/\s+PRIMARY KEY/i, '').trim();
    columns.push({ name: colMatch[1], typeDef });
  }

  return { tableName, columns };
}

/** @param {string} body */
function splitCreateTableBody(body) {
  const parts = [];
  let cur = '';
  let depth = 0;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string} tableName
 * @returns {Promise<Set<string>>}
 */
async function listExistingColumns(sequelize, tableName) {
  const [ rows ] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = :tableName`,
    { replacements: { tableName } },
  );
  return new Set(rows.map(r => r.column_name));
}

/**
 * 对比 init.sql 与库表，自动 ADD COLUMN IF NOT EXISTS
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string} dbDir
 * @param {{ logger?: Console }} [opts]
 */
async function syncTableColumnsFromInitSql(sequelize, dbDir, opts = {}) {
  const logger = opts.logger || console;
  const tablesDir = path.join(dbDir, 'tables');
  if (!fs.existsSync(tablesDir)) return { added: 0, tables: 0 };

  let added = 0;
  let tables = 0;

  for (const name of loadTablesOrder(dbDir)) {
    if (name.startsWith('v_')) continue;
    const initFile = path.join(tablesDir, name, 'init.sql');
    if (!fs.existsSync(initFile)) continue;

    const sql = fs.readFileSync(initFile, 'utf8');
    const parsed = parseCreateTable(sql);
    if (!parsed || parsed.tableName !== name) continue;

    const existing = await listExistingColumns(sequelize, name);
    if (!existing.size) continue;

    tables += 1;
    for (const col of parsed.columns) {
      if (existing.has(col.name)) continue;
      const addType = col.typeDef.replace(/\s+NOT NULL(?:\s+DEFAULT[^,]*)?/i, '').trim();
      const alterSql = `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${col.name}" ${addType}`;
      try {
        await sequelize.query(alterSql);
        added += 1;
        logger.info('[SchemaSync] Added column %s.%s', name, col.name);
      } catch (err) {
        logger.warn('[SchemaSync] Column %s.%s skipped: %s', name, col.name, err.message);
      }
    }
  }

  return { added, tables };
}

module.exports = {
  parseCreateTable,
  syncTableColumnsFromInitSql,
};
