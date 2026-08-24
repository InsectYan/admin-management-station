#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";

const upPath = "e:/AI Tools/projects/fitness-agent-test-docs/数据库详细表/test_item_detail/data.json";
const tgPath = "e:/AI Tools/projects/admin-management-station/project-sub/testgen-sub/database/tables/test_item_detail/data.json";
const initSqlFile = "e:/AI Tools/projects/admin-management-station/project-sub/testgen-sub/database/tables/test_item_detail/init.sql";
const tableDocFile = "e:/AI Tools/projects/admin-management-station/project-sub/testgen-sub/database/tables/test_item_detail/表说明.md";
const majorFile = "e:/AI Tools/projects/admin-management-station/project-sub/testgen-sub/database/tables/test_category_major/data.json";
const majorInitFile = "e:/AI Tools/projects/admin-management-station/project-sub/testgen-sub/database/tables/test_category_major/init.sql";
const prefixData = "e:/AI Tools/projects/admin-management-station/project-sub/testgen-sub/database/tables/test_item_prefix_scheme/data.json";
const prefixInit = "e:/AI Tools/projects/admin-management-station/project-sub/testgen-sub/database/tables/test_item_prefix_scheme/init.sql";

const INSERT_COLUMNS = [
  "item_id", "dimension_id", "category_major_id", "category_minor_id", "sub_class",
  "item_name", "detail_summary", "expected_observation", "test_input_example",
  "preconditions", "test_steps", "assertion_points", "priority_id",
  "prd_ref_id", "prd_ref_ids", "arch_ref_id", "arch_ref_ids", "prd_goal_ids",
  "automation_status_id", "automation_entry_id", "automation_command",
  "config_env", "config_env_id", "station_id", "role_scope_id",
  "endpoint_path", "http_method", "http_status_expected", "template_code",
  "scheme_primary_id", "scheme_secondary_id", "validation_primary_id", "validation_secondary_id",
  "sample_execution_note", "scheme_mapping_source",
  "is_risk_flag", "is_observability_audit", "is_p0_blocker",
  "failure_symptom", "code_reference", "tags", "notes",
  "source_doc", "source_section", "is_active",
];

function sqlVal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v) || typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

const up = JSON.parse(readFileSync(upPath, "utf8"));
const tg = JSON.parse(readFileSync(tgPath, "utf8"));
const tgIds = new Set(tg.map((x) => x.item_id));
const missing = up.filter((x) => !tgIds.has(x.item_id));
console.log("missing", missing.map((x) => x.item_id).join(", "));

for (const src of missing) {
  tg.push({
    ...src,
    template_code: src.template_code ?? null,
    preconditions: src.preconditions?.length ? src.preconditions : ["local 全栈或 AgentRun 环境可用"],
    test_steps: src.test_steps?.length ? src.test_steps : ["按用例前置准备", "执行步骤", `断言：${src.expected_observation}`],
    assertion_points: src.assertion_points?.length ? src.assertion_points : [src.expected_observation],
    prd_ref_ids: src.prd_ref_ids || [],
    arch_ref_ids: src.arch_ref_ids || [],
    prd_goal_ids: src.prd_goal_ids || [],
    tags: src.tags || [src.category_major_id],
    is_active: true,
    exec_env_id: "EXEC_BOTH",
    env_tier_id: "TIER_ANY",
    project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目",
    notes: `${src.notes || ""}；parser-fix 补入（核心细节原文）`.replace(/^；/, ""),
  });
}

writeFileSync(tgPath, `${JSON.stringify(tg, null, 2)}\n`);

const ddlEnd = readFileSync(initSqlFile, "utf8").split("\n-- 数据导入")[0];
const lines = tg.filter((r) => r.is_active !== false).map((r) => {
  const filtered = {};
  for (const col of INSERT_COLUMNS) filtered[col] = r[col] ?? null;
  return `INSERT INTO test_item_detail (${INSERT_COLUMNS.join(", ")}) VALUES (${INSERT_COLUMNS.map((c) => sqlVal(filtered[c])).join(", ")}) ON CONFLICT (item_id) DO NOTHING;`;
});
writeFileSync(initSqlFile, `${ddlEnd}\n-- 数据导入（${tg.length} 条）\n${lines.join("\n")}\n`);

const majors = JSON.parse(readFileSync(majorFile, "utf8"));
const countByMajor = {};
for (const r of tg.filter((x) => x.is_active !== false)) {
  countByMajor[r.category_major_id] = (countByMajor[r.category_major_id] || 0) + 1;
}
for (const m of majors) {
  if (countByMajor[m.category_major_id] !== undefined) m.item_count = countByMajor[m.category_major_id];
}
writeFileSync(majorFile, `${JSON.stringify(majors, null, 2)}\n`);
let majorInit = readFileSync(majorInitFile, "utf8");
for (const m of majors) {
  const re = new RegExp(
    `(INSERT INTO test_category_major[^;]*'${m.category_major_id}'[^;]*item_count, default_scheme_id\\) VALUES \\('${m.category_major_id}', '[^']+', '[^']+', '[^']+', )\\d+`,
  );
  majorInit = majorInit.replace(re, `$1${m.item_count}`);
}
writeFileSync(majorInitFile, majorInit);

let doc = readFileSync(tableDocFile, "utf8");
doc = doc.replace(/共 \*\*\d+\*\* 条/, `共 **${tg.length}** 条`);
doc = doc.replace(/> \d+ 条可执行测试项/, `> ${tg.length} 条可执行测试项`);
writeFileSync(tableDocFile, doc);

const prefixes = JSON.parse(readFileSync(prefixData, "utf8"));
const prefixInserts = prefixes.map((p) =>
  `INSERT INTO test_item_prefix_scheme (mapping_id, item_prefix, scheme_primary_id, scheme_secondary_id, validation_primary_id, validation_secondary_id, sample_execution_note, mapping_source) VALUES ('${p.mapping_id}', '${p.item_prefix}', '${p.scheme_primary_id}', ${p.scheme_secondary_id ? `'${p.scheme_secondary_id}'` : "NULL"}, '${p.validation_primary_id}', ${p.validation_secondary_id ? `'${p.validation_secondary_id}'` : "NULL"}, '${String(p.sample_execution_note || "").replace(/'/g, "''")}', '${p.mapping_source}') ON CONFLICT (mapping_id) DO NOTHING;`,
);
const prefixDdl = readFileSync(prefixInit, "utf8").split("\n-- 数据导入")[0];
writeFileSync(prefixInit, `${prefixDdl}\n-- 数据导入（${prefixes.length} 条）\n${prefixInserts.join("\n")}\n`);

console.log("testgen now", tg.length, "prefix", prefixes.length);
