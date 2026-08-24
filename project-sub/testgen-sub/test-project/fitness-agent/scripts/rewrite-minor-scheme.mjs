#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../database/tables/test_category_minor_scheme");

const minors = [
  ["T1_SCHEMA", "T1-", "TS-01-DET", "VS-02-CONTRACT", "契约"],
  ["T1_STATIC", "T1-", "TS-01-DET", "VS-01-EXACT", "静态守卫"],
  ["T2_ROLE", "T2-", "TS-02-BND", "VS-03-ZERO", "角色围栏"],
  ["T2_CAPABILITY", "T2-", "TS-02-BND", "VS-03-ZERO", "能力边界"],
  ["T2_PAYLOAD", "T2-", "TS-02-BND", "VS-03-ZERO", "载荷"],
  ["T3_FLOW", "T3-", "TS-05-CHAIN", "VS-04-CHAIN-OK", "工作流"],
  ["T3_STATE", "T3-", "TS-05-CHAIN", "VS-04-CHAIN-OK", "状态机"],
  ["T3_CONFIRM", "T3-", "TS-05-CHAIN", "VS-04-CHAIN-OK", "确认两轮"],
  ["T4_ROUTE", "T4-", "TS-04-SET", "VS-07-RATE-H", "路由策略"],
  ["T4_INTENT", "T4-", "TS-04-SET", "VS-07-RATE-H", "意图规则"],
  ["T5_TOOL", "T5-", "TS-01-DET", "VS-02-CONTRACT", "工具"],
  ["T5_MEMORY", "T5-", "TS-01-DET", "VS-02-CONTRACT", "记忆"],
  ["T5_RETRIEVAL", "T5-", "TS-01-DET", "VS-01-EXACT", "检索"],
  ["T6_SAFETY", "T6-", "TS-07-NEG", "VS-09-BLOCK-H", "安全"],
  ["T6_PRIVACY", "T6-", "TS-01-DET", "VS-01-EXACT", "隐私"],
  ["T6_BLOCK", "T6-", "TS-07-NEG", "VS-09-BLOCK-H", "高风险"],
  ["T7_HTTP", "T7-", "TS-01-DET", "VS-01-EXACT", "HTTP"],
  ["T7_STREAM", "T7-", "TS-01-DET", "VS-01-EXACT", "流式"],
  ["T8_IDEM", "T8-", "TS-03-REP", "VS-01-EXACT", "幂等"],
  ["T8_RECOVER", "T8-", "TS-03-REP", "VS-01-EXACT", "恢复"],
  ["T9_LATENCY", "T9-", "TS-09-LOAD", "VS-10-SLO-M", "延迟"],
  ["T9_CAPACITY", "T9-", "TS-09-LOAD", "VS-10-SLO-M", "容量"],
  ["T10_COPY", "T10-", "TS-03-REP", "VS-07-RATE-M", "文案"],
  ["T10_UI", "T10-", "TS-03-REP", "VS-07-RATE-M", "UI"],
  ["T11_LOG", "T11-", "TS-08-OBS", "VS-05-PRESENCE", "日志"],
  ["T11_TRACE", "T11-", "TS-08-OBS", "VS-05-PRESENCE", "Trace"],
  ["T12_GOLDEN", "T12-", "TS-04-SET", "VS-07-RATE-H", "Golden"],
  ["T12_REGRESS", "T12-", "TS-04-SET", "VS-07-RATE-H", "回归"],
];

const rows = minors.map(([id, prefix, sch, vs, note]) => ({
  category_minor_id: id,
  item_prefix: prefix,
  scheme_primary_id: sch,
  scheme_secondary_id: null,
  validation_primary_id: vs,
  validation_secondary_id: null,
  sample_execution_note: note,
  mapping_source: "T1-T12",
  project_code: "fitness-agent",
}));

writeFileSync(join(dir, "data.json"), `${JSON.stringify(rows, null, 2)}\n`);
const raw = readFileSync(join(dir, "init.sql"), "utf8");
const ddl = raw.split(/\r?\n/).filter((l) => !/^\s*INSERT\s+INTO/i.test(l) && !/^\s*--\s*数据导入/.test(l));
while (ddl.length && !ddl[ddl.length - 1].trim()) ddl.pop();
const inserts = rows.map(
  (r) =>
    `INSERT INTO test_category_minor_scheme (category_minor_id, item_prefix, scheme_primary_id, scheme_secondary_id, validation_primary_id, validation_secondary_id, sample_execution_note, mapping_source) VALUES ('${r.category_minor_id}', '${r.item_prefix}', '${r.scheme_primary_id}', NULL, '${r.validation_primary_id}', NULL, '${r.sample_execution_note}', '${r.mapping_source}') ON CONFLICT (category_minor_id) DO NOTHING;`,
);
writeFileSync(join(dir, "init.sql"), `${ddl.join("\n")}\n\n-- 数据导入（${rows.length} 条 · T1–T12）\n${inserts.join("\n")}\n`);
console.log("wrote minor_scheme", rows.length);
