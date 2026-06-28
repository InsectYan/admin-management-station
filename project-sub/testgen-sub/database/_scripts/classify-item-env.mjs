#!/usr/bin/env node
/**
 * 为 test_item_detail/data.json 批量写入 exec_env_id、env_tier_id
 * 规则依据 A 层站测 / E2E / A5 容量多实例 / 人工 UAT 分层
 * 用法: node database/_scripts/classify-item-env.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, '../tables/test_item_detail/data.json');

/** @param {Record<string, unknown>} item */
function classifyItem(item) {
  const id = String(item.item_id || '');
  const major = String(item.category_major_id || '');
  const auto = String(item.automation_status_id || '');
  const entry = String(item.automation_entry_id || '');
  const note = String(item.sample_execution_note || '');
  const sub = String(item.sub_class || '');
  const station = String(item.station_id || '');

  if (auto === 'AUTO_MANUAL') {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_PROD_ONLY' };
  }

  if (id.includes('MULTI') || (sub.includes('多实例') && id.startsWith('A5-'))) {
    return { exec_env_id: 'EXEC_TEST', env_tier_id: 'TIER_STAGING' };
  }

  if (id.startsWith('A5-CAP') || id.startsWith('A5-STALE')) {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_LOCAL' };
  }

  if (id.startsWith('A5-')) {
    return { exec_env_id: 'EXEC_TEST', env_tier_id: 'TIER_STAGING' };
  }

  if (id.startsWith('A6-GOLDEN')) {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_LOCAL' };
  }

  if (id.startsWith('A6-MEDICAL')) {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_STAGING' };
  }

  if (major === 'A4' || id.startsWith('A4-') || entry.startsWith('AUTO_E2E')) {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_STAGING' };
  }

  if (id.startsWith('A1-') || id.startsWith('A2-') || id.startsWith('A3-')) {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_ANY' };
  }

  if (auto === 'AUTO_EXISTING' && station !== 'NONE') {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_ANY' };
  }

  if (item.is_observability_audit || note.includes('可观测') || id.includes('-OBS-')) {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_STAGING' };
  }

  if (note.includes('压测') || note.includes('多实例')) {
    return { exec_env_id: 'EXEC_TEST', env_tier_id: 'TIER_STAGING' };
  }

  if (note.includes('Golden') || note.includes('专家')) {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_STAGING' };
  }

  if (auto === 'AUTO_TODO' && item.dimension_id === 'A') {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_ANY' };
  }

  if (auto === 'AUTO_TODO') {
    return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_STAGING' };
  }

  return { exec_env_id: 'EXEC_BOTH', env_tier_id: 'TIER_STAGING' };
}

const rows = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const stats = {};

for (const row of rows) {
  const { exec_env_id, env_tier_id } = classifyItem(row);
  row.exec_env_id = exec_env_id;
  row.env_tier_id = env_tier_id;
  const key = `${exec_env_id}/${env_tier_id}`;
  stats[key] = (stats[key] || 0) + 1;
}

fs.writeFileSync(dataPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
console.log(`[classify-item-env] updated ${rows.length} rows`);
console.log(stats);
