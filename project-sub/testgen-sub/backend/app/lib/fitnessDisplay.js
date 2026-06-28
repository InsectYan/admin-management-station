'use strict';

const fs = require('fs');
const path = require('path');

let cachedLabels = null;

function resolveDatabaseDir(baseDir) {
  const candidates = [
    path.join(baseDir, '../database'),
    path.join(baseDir, 'database'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'display-labels.json'))) return dir;
  }
  return null;
}

function loadDisplayLabels(baseDir) {
  if (cachedLabels) return cachedLabels;
  const dbDir = resolveDatabaseDir(baseDir || path.join(__dirname, '../..'));
  if (!dbDir) {
    cachedLabels = { tables: {}, defaultColumnLabel: '字段' };
    return cachedLabels;
  }
  cachedLabels = JSON.parse(fs.readFileSync(path.join(dbDir, 'display-labels.json'), 'utf8'));
  return cachedLabels;
}

function getTableMeta(tableName, baseDir) {
  const labels = loadDisplayLabels(baseDir);
  return labels.tables?.[tableName] || null;
}

function getColumnLabel(tableName, columnName, baseDir) {
  const meta = getTableMeta(tableName, baseDir);
  if (!meta?.columns?.[columnName]) {
    const labels = loadDisplayLabels(baseDir);
    return labels.defaultColumnLabel || columnName;
  }
  return meta.columns[columnName];
}

function getDisplayColumns(tableName, rowKeys, baseDir) {
  const meta = getTableMeta(tableName, baseDir);
  if (!meta?.columns) {
    return rowKeys.map(key => ({ prop: key, label: key }));
  }
  const ordered = Object.keys(meta.columns).filter(k => rowKeys.includes(k));
  const rest = rowKeys.filter(k => !ordered.includes(k) && !k.endsWith('_id') || meta.columns[k]);
  const props = [ ...ordered, ...rest.filter(k => !ordered.includes(k)) ];
  const seen = new Set();
  return props.filter(p => {
    if (seen.has(p)) return false;
    seen.add(p);
    return rowKeys.includes(p);
  }).map(prop => ({
    prop,
    label: meta.columns[prop] || prop,
  }));
}

/**
 * @param {import('sequelize').Sequelize} model
 * @param {string} tableName
 * @param {Record<string, unknown>[]} rows
 * @param {string} [baseDir]
 */
async function enrichRowsWithFkNames(model, tableName, rows, baseDir) {
  if (!rows?.length) return rows;
  const meta = getTableMeta(tableName, baseDir);
  if (!meta?.fk) return rows;

  const lookupCache = {};
  for (const [ field, rule ] of Object.entries(meta.fk)) {
    const as = rule.as || `${field.replace(/_id$/, '')}_name`;
    const ids = [ ...new Set(rows.map(r => r[field]).filter(Boolean)) ];
    if (!ids.length) continue;

    const cacheKey = `${rule.ref}:${rule.key}:${rule.label}`;
    if (!lookupCache[cacheKey]) {
      const [ refRows ] = await model.query(
        `SELECT "${rule.key}" AS id, "${rule.label}" AS label FROM "${rule.ref}" WHERE "${rule.key}" IN (:ids)`,
        { replacements: { ids } },
      );
      lookupCache[cacheKey] = Object.fromEntries(refRows.map(r => [ r.id, r.label ]));
    }
    const map = lookupCache[cacheKey];
    for (const row of rows) {
      if (row[field] && map[row[field]]) row[as] = map[row[field]];
    }
  }
  return rows;
}

function paginateRows(rows, page = 1, pageSize = 20) {
  const total = rows.length;
  const offset = (Number(page) - 1) * Number(pageSize);
  return {
    list: rows.slice(offset, offset + Number(pageSize)),
    total,
    page: Number(page),
    pageSize: Number(pageSize),
  };
}

module.exports = {
  loadDisplayLabels,
  getTableMeta,
  getColumnLabel,
  getDisplayColumns,
  enrichRowsWithFkNames,
  paginateRows,
  resolveDatabaseDir,
};
