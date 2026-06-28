'use strict';

/**
 * 按 display-labels.json 的 fk 规则，为 data.json 补充 *_name 冗余字段
 * 用法: node backend/scripts/enrich-data-json-fk.js
 */

const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '../../database');
const tablesDir = path.join(dbDir, 'tables');
const labels = JSON.parse(fs.readFileSync(path.join(dbDir, 'display-labels.json'), 'utf8'));

function loadLookup(refTable, key, labelCol) {
  const dataFile = path.join(tablesDir, refTable, 'data.json');
  if (!fs.existsSync(dataFile)) return {};
  const rows = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  return Object.fromEntries(rows.map(r => [ r[key], r[labelCol] ]));
}

function enrichAll() {
  let updated = 0;
  for (const [ table, meta ] of Object.entries(labels.tables || {})) {
    if (!meta.fk) continue;
    const dataFile = path.join(tablesDir, table, 'data.json');
    if (!fs.existsSync(dataFile)) continue;

    const rows = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    if (!Array.isArray(rows) || !rows.length) continue;

    const lookups = {};
    for (const [ field, rule ] of Object.entries(meta.fk)) {
      const as = rule.as || `${field.replace(/_id$/, '')}_name`;
      lookups[field] = { as, map: loadLookup(rule.ref, rule.key, rule.label) };
    }

    let changed = false;
    for (const row of rows) {
      for (const [ field, { as, map } ] of Object.entries(lookups)) {
        if (row[field] && map[row[field]] && row[as] !== map[row[field]]) {
          row[as] = map[row[field]];
          changed = true;
        }
      }
    }

    if (changed) {
      fs.writeFileSync(dataFile, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
      updated += 1;
      console.log(`[enrich] ${table}/data.json`);
    }
  }
  return updated;
}

if (require.main === module) {
  const n = enrichAll();
  console.log(`完成，更新 ${n} 个 data.json`);
}

module.exports = { enrichAll };
