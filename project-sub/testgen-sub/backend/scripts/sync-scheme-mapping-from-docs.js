'use strict';

/**
 * 从 docs/fitness-test-docs 方案映射 Markdown 同步 test_item_prefix_scheme，
 * 并调用 resolve-item-schemes 补全 test_item_detail TS/VS。
 *
 * 用法:
 *   node backend/scripts/sync-scheme-mapping-from-docs.js --check
 *   node backend/scripts/sync-scheme-mapping-from-docs.js --write
 */

const fs = require('fs');
const path = require('path');
const { loadSchemeMappingRules } = require('./lib/scheme-mapping-parser');
const { resolveAll } = require('./resolve-item-schemes');

const root = path.join(__dirname, '../..');
const mappingDir = path.join(root, 'docs/fitness-test-docs/测试方案核心细节与方案关系');
const prefixTablePath = path.join(root, 'database/tables/test_item_prefix_scheme/data.json');

function readPrefixRows() {
  return JSON.parse(fs.readFileSync(prefixTablePath, 'utf8'));
}

function buildPrefixRows(rules) {
  return rules.map((r, i) => ({
    mapping_id: `MAP${String(i + 1).padStart(4, '0')}`,
    item_prefix: r.prefix,
    scheme_primary_id: r.scheme_primary_id,
    scheme_secondary_id: r.scheme_secondary_id,
    validation_primary_id: r.validation_primary_id,
    validation_secondary_id: r.validation_secondary_id,
    sample_execution_note: r.sample_execution_note,
    mapping_source: r.mapping_source,
  }));
}

function diffPrefixRows(existing, next) {
  const key = row => `${row.item_prefix}|${row.scheme_primary_id}|${row.validation_primary_id}|${row.mapping_source}`;
  const existMap = new Map(existing.map(r => [ key(r), r ]));
  const nextMap = new Map(next.map(r => [ key(r), r ]));
  const added = next.filter(r => !existMap.has(key(r)));
  const removed = existing.filter(r => !nextMap.has(key(r)));
  const changedSource = next.filter(r => {
    const old = existing.find(e => e.item_prefix === r.item_prefix);
    return old && old.mapping_source !== r.mapping_source;
  });
  return { added, removed, changedSource, existingCount: existing.length, nextCount: next.length };
}

function main() {
  const write = process.argv.includes('--write');
  const check = process.argv.includes('--check') || !write;

  if (!fs.existsSync(mappingDir)) {
    console.error(`[sync-scheme] 映射目录不存在: ${mappingDir}`);
    process.exit(1);
  }

  const rules = loadSchemeMappingRules(mappingDir);
  const nextRows = buildPrefixRows(rules);
  const existing = readPrefixRows();
  const diff = diffPrefixRows(existing, nextRows);

  console.log(`[sync-scheme] 解析 ${rules.length} 条前缀规则（${mappingDir}）`);
  console.log(`[sync-scheme] prefix 表: 现有 ${diff.existingCount} → 文档 ${diff.nextCount}`);

  if (diff.added.length) console.log(`  + 新增 ${diff.added.length} 条`);
  if (diff.removed.length) console.log(`  - 移除 ${diff.removed.length} 条`);
  if (diff.changedSource.length) console.log(`  ~ mapping_source 变更 ${diff.changedSource.length} 条`);

  if (check && (diff.added.length || diff.removed.length || diff.changedSource.length)) {
    console.log('[sync-scheme] --check: 文档与 DB 不一致，请运行 --write 同步');
    process.exit(2);
  }

  if (write) {
    fs.writeFileSync(prefixTablePath, `${JSON.stringify(nextRows, null, 2)}\n`, 'utf8');
    console.log(`[sync-scheme] 已写入 ${prefixTablePath}`);
    const stats = resolveAll();
    console.log(`[sync-scheme] resolve: items=${stats.items}, 补主=${stats.filledPrimary}, 补辅=${stats.filledSecondary}`);
  } else if (!diff.added.length && !diff.removed.length && !diff.changedSource.length) {
    console.log('[sync-scheme] --check: 文档与 prefix 表一致');
  }
}

if (require.main === module) {
  main();
}

module.exports = { buildPrefixRows, diffPrefixRows };
