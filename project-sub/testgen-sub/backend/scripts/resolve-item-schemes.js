'use strict';

/**
 * 按 fitness-agent-test-docs 规则为 test_item_detail 补全主/辅 TS/VS，
 * 并生成 test_category_minor_scheme 子类默认方案表数据。
 * 用法: node backend/scripts/resolve-item-schemes.js
 */

const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '../../database');
const tablesDir = path.join(dbDir, 'tables');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(dbDir, rel), 'utf8'));
}

function readTableJson(table) {
  return JSON.parse(fs.readFileSync(path.join(tablesDir, table, 'data.json'), 'utf8'));
}

function writeTableJson(table, rows) {
  const dir = path.join(tablesDir, table);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'data.json'), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
}

function normalizeVs(vs) {
  if (!vs) return null;
  if (vs === 'VS-09-BLOCK') return 'VS-09-BLOCK-H';
  if (vs.startsWith('VS-10-SLO') && !/-[LMH]$/.test(vs)) return 'VS-10-SLO-M';
  return vs;
}

function mapEntryToScheme(entry, source) {
  if (!entry) return null;
  return {
    scheme_primary_id: entry.ts || null,
    scheme_secondary_id: entry.ts2 || null,
    validation_primary_id: normalizeVs(entry.vs),
    validation_secondary_id: normalizeVs(entry.vs2),
    sample_execution_note: entry.sample || null,
    scheme_mapping_source: source,
  };
}

function resolveByPrefix(itemId, rules) {
  for (const r of rules) {
    if (!r.scheme_primary_id) continue;
    const prefix = r.item_prefix || r.prefix;
    if (!prefix) continue;
    if (prefix.endsWith('-')) {
      if (itemId.startsWith(prefix)) return r;
    } else if (itemId === prefix) {
      return r;
    }
  }
  return null;
}

function resolveBySchemeMap(itemId, mapEntries) {
  for (const [ prefix, entry ] of mapEntries) {
    if (itemId.startsWith(prefix)) {
      return mapEntryToScheme(entry, 'scheme-map.json');
    }
  }
  return null;
}

function minorCandidatePrefixes(minorId, majorId) {
  const out = new Set();
  if (minorId.includes('_')) {
    const idx = minorId.indexOf('_');
    const head = minorId.slice(0, idx);
    const tail = minorId.slice(idx + 1).replace(/_/g, '-');
    out.add(`${head}-${tail}-`);
  }
  if (majorId) {
    out.add(`${majorId}-`);
    if (majorId.includes('_')) out.add(`${majorId.replace('_', '-')}-`);
  }
  return [ ...out ];
}

function buildMinorSchemeRows(minors, majors, dimensions, schemeMap) {
  const majorById = Object.fromEntries(majors.map(m => [ m.category_major_id, m ]));
  const dimById = Object.fromEntries(dimensions.map(d => [ d.dimension_id, d ]));
  const mapEntries = Object.entries(schemeMap).sort((a, b) => b[0].length - a[0].length);

  return minors.map(minor => {
    const major = majorById[minor.category_major_id];
    const dim = major ? dimById[major.dimension_id] : null;
    let matched = null;
    let itemPrefix = '';

    for (const prefix of minorCandidatePrefixes(minor.category_minor_id, minor.category_major_id)) {
      const hit = mapEntries.find(([ p ]) => p === prefix || prefix.startsWith(p) || p.startsWith(prefix));
      if (hit) {
        matched = mapEntryToScheme(hit[1], 'scheme-map.json');
        itemPrefix = hit[0];
        break;
      }
    }

    if (!matched) {
      matched = {
        scheme_primary_id: major?.default_scheme_id || dim?.default_scheme_id || 'TS-01-DET',
        scheme_secondary_id: null,
        validation_primary_id: major?.default_validation_id || dim?.default_validation_id || 'VS-01-EXACT',
        validation_secondary_id: null,
        sample_execution_note: null,
        scheme_mapping_source: 'dimension/major-default',
      };
      itemPrefix = `${minor.category_major_id}-`;
    }

    return {
      category_minor_id: minor.category_minor_id,
      item_prefix: itemPrefix,
      scheme_primary_id: matched.scheme_primary_id,
      scheme_secondary_id: matched.scheme_secondary_id,
      validation_primary_id: matched.validation_primary_id,
      validation_secondary_id: matched.validation_secondary_id,
      sample_execution_note: matched.sample_execution_note,
      mapping_source: matched.scheme_mapping_source,
    };
  });
}

function enrichMajorValidationDefaults(majors, dimensions) {
  const dimById = Object.fromEntries(dimensions.map(d => [ d.dimension_id, d ]));
  for (const m of majors) {
    const dim = dimById[m.dimension_id];
    if (!m.default_validation_id && dim?.default_validation_id) {
      m.default_validation_id = dim.default_validation_id;
    }
  }
  return majors;
}

function resolveAll() {
  const schemeMap = readJson('scheme-map.json');
  const dimensions = readTableJson('test_dimension');
  let majors = readTableJson('test_category_major');
  const minors = readTableJson('test_category_minor');
  const prefixRules = readTableJson('test_item_prefix_scheme')
    .map(r => ({ ...r, item_prefix: r.item_prefix }))
    .sort((a, b) => b.item_prefix.length - a.item_prefix.length);
  const minorSchemes = buildMinorSchemeRows(minors, majors, dimensions, schemeMap);
  const minorById = Object.fromEntries(minorSchemes.map(r => [ r.category_minor_id, r ]));
  const majorById = Object.fromEntries(majors.map(m => [ m.category_major_id, m ]));
  const dimById = Object.fromEntries(dimensions.map(d => [ d.dimension_id, d ]));
  const mapEntries = Object.entries(schemeMap).sort((a, b) => b[0].length - a[0].length);

  majors = enrichMajorValidationDefaults(majors, dimensions);

  const items = readTableJson('test_item_detail');
  let filledPrimary = 0;
  let filledSecondary = 0;

  for (const item of items) {
    let resolved = resolveByPrefix(item.item_id, prefixRules);
    if (!resolved) resolved = resolveBySchemeMap(item.item_id, mapEntries);
    if (!resolved) {
      const minorRule = minorById[item.category_minor_id];
      if (minorRule) resolved = minorRule;
    }
    if (!resolved) {
      const major = majorById[item.category_major_id];
      const dim = dimById[item.dimension_id];
      resolved = {
        scheme_primary_id: major?.default_scheme_id || dim?.default_scheme_id,
        scheme_secondary_id: null,
        validation_primary_id: major?.default_validation_id || dim?.default_validation_id,
        validation_secondary_id: null,
        sample_execution_note: item.sample_execution_note,
        mapping_source: 'dimension/major-default',
      };
    }

    if (!item.scheme_primary_id && resolved.scheme_primary_id) {
      item.scheme_primary_id = resolved.scheme_primary_id;
      filledPrimary += 1;
    }
    if (!item.validation_primary_id && resolved.validation_primary_id) {
      item.validation_primary_id = resolved.validation_primary_id;
      filledPrimary += 1;
    }
    if (!item.scheme_secondary_id && resolved.scheme_secondary_id) {
      item.scheme_secondary_id = resolved.scheme_secondary_id;
      filledSecondary += 1;
    }
    if (!item.validation_secondary_id && resolved.validation_secondary_id) {
      item.validation_secondary_id = resolved.validation_secondary_id;
      filledSecondary += 1;
    }
    if (!item.scheme_mapping_source && resolved.mapping_source) {
      item.scheme_mapping_source = resolved.mapping_source;
    }
    if (!item.sample_execution_note && resolved.sample_execution_note) {
      item.sample_execution_note = resolved.sample_execution_note;
    }
  }

  writeTableJson('test_item_detail', items);
  writeTableJson('test_category_major', majors);
  writeTableJson('test_category_minor_scheme', minorSchemes);

  return {
    items: items.length,
    minorSchemes: minorSchemes.length,
    filledPrimary,
    filledSecondary,
  };
}

if (require.main === module) {
  const stats = resolveAll();
  console.log(`[resolve] test_item_detail ${stats.items} 条, 补主 TS/VS ${stats.filledPrimary} 处, 补辅 ${stats.filledSecondary} 处`);
  console.log(`[resolve] test_category_minor_scheme ${stats.minorSchemes} 条`);
}

module.exports = { resolveAll };
