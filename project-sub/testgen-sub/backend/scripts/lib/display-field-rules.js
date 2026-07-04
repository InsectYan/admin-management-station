'use strict';

const fs = require('fs');
const path = require('path');

let cachedRules = null;

function resolveDatabaseDir(baseDir) {
  const candidates = [
    path.join(baseDir || '', '../database'),
    path.join(baseDir || '', 'database'),
    path.join(__dirname, '../../../database'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'display-field-rules.json'))) return dir;
  }
  return path.join(__dirname, '../../../database');
}

function loadDisplayFieldRules(baseDir) {
  if (cachedRules) return cachedRules;
  const file = path.join(resolveDatabaseDir(baseDir), 'display-field-rules.json');
  cachedRules = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : { hideIdWhenNamePresent: true, explicitIdToName: {}, seedExcludePatterns: [] };
  return cachedRules;
}

/** @param {string} idProp */
function resolveNameField(idProp) {
  const rules = loadDisplayFieldRules();
  if (rules.explicitIdToName?.[idProp]) return rules.explicitIdToName[idProp];
  if (idProp.endsWith('_id')) return `${idProp.slice(0, -3)}_name`;
  return null;
}

/**
 * 表格列：有对应名称列时隐藏 id/code 列，避免重复展示
 * @param {{ prop: string, label?: string }[]} columns
 * @param {string[]} [rowKeys]
 */
function preferNameOnlyColumns(columns, rowKeys) {
  const rules = loadDisplayFieldRules();
  if (!rules.hideIdWhenNamePresent || !columns?.length) return columns || [];
  const keys = new Set(rowKeys || columns.map(c => c.prop));
  return columns.filter(col => {
    const nameProp = resolveNameField(col.prop);
    if (!nameProp) return true;
    return !keys.has(nameProp);
  });
}

/**
 * 去掉名称前重复的 id/code 前缀
 * @param {string|null|undefined} id
 * @param {string|null|undefined} label
 */
function stripIdPrefixFromLabel(id, label) {
  if (!label || typeof label !== 'string') return label;
  if (!id || typeof id !== 'string') return label.trim();
  let trimmed = label.trim();
  const bracket = `[${id}]`;
  const bracketPrefixes = [ `${bracket} `, `${bracket}—`, `${bracket} —`, bracket ];
  for (const p of bracketPrefixes) {
    if (trimmed.startsWith(p)) {
      trimmed = trimmed.slice(p.length).trim();
      break;
    }
  }
  const prefixes = [ `${id} `, `${id}·`, `${id} · `, `${id} - `, `${id}-` ];
  for (const p of prefixes) {
    if (trimmed.startsWith(p)) return trimmed.slice(p.length).trim();
  }
  return trimmed;
}

/**
 * seed 时排除 data.json 中的纯展示字段
 * @param {string} key
 */
function isDisplayOnlySeedField(key) {
  const rules = loadDisplayFieldRules();
  const patterns = rules.seedExcludePatterns || [];
  return patterns.some(re => new RegExp(re).test(key));
}

module.exports = {
  loadDisplayFieldRules,
  resolveNameField,
  preferNameOnlyColumns,
  stripIdPrefixFromLabel,
  isDisplayOnlySeedField,
};
