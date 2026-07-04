'use strict';

/**
 * 解析 docs/fitness-test-docs/测试方案核心细节与方案关系/*-方案映射.md
 * 逻辑对齐 fitness-agent-test-docs/数据库详细表/_scripts/lib/scheme-mapping-parser.mjs
 */

const fs = require('fs');
const path = require('path');

const TS_RE = /TS-\d{2}-[A-Z]+/g;
const VS_RE = /VS-\d{2}-[A-Z0-9]+(?:-[LMH])?/g;

function normalizeVs(vs) {
  if (!vs) return null;
  if (vs === 'VS-09-BLOCK') return 'VS-09-BLOCK-H';
  if (vs.startsWith('VS-10-SLO') && !/-[LMH]$/.test(vs)) return 'VS-10-SLO-M';
  return vs;
}

function extractPrefixes(cell) {
  const out = new Set();
  const range = cell.match(/([A-Z][A-Z0-9-]*-)\d{3}[～~]\d{3}/);
  if (range) out.add(range[1]);
  for (const m of cell.matchAll(/([A-Z][A-Z0-9-]*(?:-[A-Z0-9]+)*)(-\*{2,3})/g)) {
    out.add(`${m[1]}-`);
  }
  for (const m of cell.matchAll(/\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d{3})\b/g)) {
    out.add(m[1]);
  }
  for (const part of cell.split(/[、,，/]/)) {
    const p = part.trim();
    if (/^[A-Z][A-Z0-9-]+-$/.test(p)) out.add(p);
    if (/^[A-Z][A-Z0-9-]+-\d{3}$/.test(p)) out.add(p);
  }
  return [ ...out ].filter(p => p.length >= 4 && !p.includes('～'));
}

/**
 * @param {string} mappingDir
 */
function loadSchemeMappingRules(mappingDir) {
  const rules = [];
  const seen = new Set();
  for (const f of fs.readdirSync(mappingDir).filter(x => x.endsWith('-方案映射.md'))) {
    const content = fs.readFileSync(path.join(mappingDir, f), 'utf8');
    for (const line of content.split('\n')) {
      if (!line.trim().startsWith('|') || line.includes('---') || line.includes('测试项前缀') || line.includes('小节')) continue;
      const cells = line.split('|').slice(1, -1).map(c => c.trim().replace(/\*\*/g, ''));
      if (!cells[0] || !/[A-Z0-9-]/.test(cells[0])) continue;
      const prefixes = extractPrefixes(cells[0]);
      const tsList = [ ...(cells[1]?.match(TS_RE) || []) ];
      const vsRaw = cells[2] || '';
      const vsList = [ ...(vsRaw.match(VS_RE) || []) ];
      const ts2List = [ ...(cells[3]?.match(TS_RE) || []) ];
      const vs2FromPlus = vsRaw.includes('+') ? vsList.slice(1) : [];
      const sample = cells[4] || cells[3] || '';
      for (const prefix of prefixes) {
        const key = `${prefix}|${tsList[0]}|${vsList[0]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rules.push({
          prefix,
          scheme_primary_id: tsList[0] || null,
          scheme_secondary_id: ts2List[0] || tsList[1] || null,
          validation_primary_id: normalizeVs(vsList[0]),
          validation_secondary_id: normalizeVs(vs2FromPlus[0] || vsList[1]),
          sample_execution_note: sample || null,
          mapping_source: f,
        });
      }
    }
  }
  return rules.sort((a, b) => b.prefix.length - a.prefix.length);
}

/**
 * @param {string} itemId
 * @param {ReturnType<loadSchemeMappingRules>} rules
 * @param {object|null} fallback
 */
function resolveSchemeForItem(itemId, rules, fallback) {
  for (const r of rules) {
    if (!r.scheme_primary_id) continue;
    if (r.prefix.endsWith('-')) {
      if (itemId.startsWith(r.prefix)) return r;
    } else if (itemId === r.prefix) {
      return r;
    }
  }
  return fallback;
}

module.exports = {
  loadSchemeMappingRules,
  resolveSchemeForItem,
  normalizeVs,
};
