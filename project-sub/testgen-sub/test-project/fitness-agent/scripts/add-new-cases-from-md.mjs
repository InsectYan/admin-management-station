#!/usr/bin/env node
/**
 * 从 fitness-agent-test-docs/新用例.md 导入 ADD-* 用例到 testgen-sub database 种子。
 * Usage: node test-project/fitness-agent/scripts/add-new-cases-from-md.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const mdPath = join(here, "../../../../../../fitness-agent-test-docs/新用例.md");

const dataFile = join(root, "database/tables/test_item_detail/data.json");
const initSqlFile = join(root, "database/tables/test_item_detail/init.sql");
const majorFile = join(root, "database/tables/test_category_major/data.json");
const majorInitFile = join(root, "database/tables/test_category_major/init.sql");
const prdRefFile = join(root, "database/tables/prd_reference/data.json");
const prdRefInitFile = join(root, "database/tables/prd_reference/init.sql");
const prdLinkFile = join(root, "database/tables/test_item_prd_ref_link/data.json");
const prdLinkInitFile = join(root, "database/tables/test_item_prd_ref_link/init.sql");
const prefixFile = join(root, "database/tables/test_item_prefix_scheme/data.json");
const prefixInitFile = join(root, "database/tables/test_item_prefix_scheme/init.sql");
const tableDocFile = join(root, "database/tables/test_item_detail/表说明.md");

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

/** @param {unknown} v */
function sqlVal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** @param {Record<string, unknown>} row */
function buildInsertLine(row) {
  const vals = INSERT_COLUMNS.map((col) => sqlVal(row[col]));
  return `INSERT INTO test_item_detail (${INSERT_COLUMNS.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT (item_id) DO NOTHING;`;
}

/** @param {string} meta */
function parsePrdRefs(meta) {
  const refs = [];
  for (const m of meta.matchAll(/(\d+)\.(\d+)/g)) {
    refs.push(`PRD_${m[1]}_${m[2]}`);
  }
  return [ ...new Set(refs) ];
}

/** 用例级分类/方案覆盖 */
const ITEM_OVERRIDES = {
  "ADD-MEMBER-COACH-001": {
    category_major_id: "C2", category_minor_id: "C2_STATE", sub_class: "会员教练关系",
    role_scope_id: "MEMBER", scheme_primary_id: "TS-05-API", validation_primary_id: "VS-07-RATE-H",
    is_risk_flag: true, is_p0_blocker: true, tags: [ "C2", "ADD", "RISK", "MEMBER-COACH" ],
    sample_execution_note: "无当前服务教练时的风险反馈语义",
    scheme_mapping_source: "C2-方案映射.md", source_section: "§5.3",
  },
  "ADD-CONTEXT-003": {
    category_major_id: "C1", category_minor_id: "C1_SAFE", sub_class: "评估上下文",
    scheme_primary_id: "TS-04-SET", validation_primary_id: "VS-07-RATE-H",
    tags: [ "C1", "ADD", "CONTEXT", "SAFE" ],
    source_section: "§4.3",
  },
  "ADD-CONTEXT-004": {
    category_major_id: "C1", category_minor_id: "C1_SAFE", sub_class: "评估上下文",
    scheme_primary_id: "TS-04-SET", validation_primary_id: "VS-07-RATE-H",
    tags: [ "C1", "ADD", "CONTEXT", "SAFE" ],
    source_section: "§4.3",
  },
  "ADD-EXEC-005-R": {
    category_minor_id: "C1_ENTRY", sub_class: "实际执行·对象绑定",
    source_section: "§4.1",
  },
  "ADD-EXEC-006-R": {
    category_minor_id: "C1_CONF", sub_class: "实际执行·写库确认",
    source_section: "§4.10",
  },
  "ADD-EXEC-008-R": {
    category_minor_id: "C1_SAFE", sub_class: "实际执行·风险识别",
    is_risk_flag: true, source_section: "§4.7",
  },
  "ADD-EXEC-009-R": {
    category_minor_id: "C1_SESSION", sub_class: "实际执行·下节课上下文",
    source_section: "§4.5",
  },
  "ADD-ADOPT-001": {
    category_major_id: "C4", category_minor_id: "C4_DATA", sub_class: "采纳质量",
    scheme_primary_id: "TS-08-OBS", validation_primary_id: "VS-05-PRESENCE",
    is_observability_audit: true, tags: [ "C4", "ADD", "ADOPT", "OBS" ],
    source_section: "§7.3",
  },
  "ADD-ADOPT-002": { category_major_id: "C4", category_minor_id: "C4_DATA", sub_class: "采纳质量", scheme_primary_id: "TS-08-OBS", validation_primary_id: "VS-05-PRESENCE", is_observability_audit: true, tags: [ "C4", "ADD", "ADOPT", "OBS" ], source_section: "§7.3" },
  "ADD-ADOPT-003": { category_major_id: "C4", category_minor_id: "C4_DATA", sub_class: "采纳质量", scheme_primary_id: "TS-08-OBS", validation_primary_id: "VS-05-PRESENCE", is_observability_audit: true, tags: [ "C4", "ADD", "ADOPT", "OBS" ], source_section: "§7.3" },
  "ADD-ADOPT-004": { category_major_id: "C4", category_minor_id: "C4_DATA", sub_class: "采纳质量", scheme_primary_id: "TS-08-OBS", validation_primary_id: "VS-05-PRESENCE", is_observability_audit: true, tags: [ "C4", "ADD", "ADOPT", "OBS" ], source_section: "§7.3" },
  "ADD-ADOPT-005": { category_major_id: "C4", category_minor_id: "C4_DATA", sub_class: "采纳质量", scheme_primary_id: "TS-08-OBS", validation_primary_id: "VS-05-PRESENCE", is_observability_audit: true, tags: [ "C4", "ADD", "ADOPT", "OBS" ], source_section: "§7.3" },
  "ADD-ADOPT-006": {
    category_major_id: "C3", category_minor_id: "C3_QUERY", sub_class: "采纳统计",
    role_scope_id: "MANAGER", scheme_primary_id: "TS-08-OBS", validation_primary_id: "VS-05-PRESENCE",
    is_observability_audit: true, tags: [ "C3", "ADD", "ADOPT", "OBS" ],
    source_section: "§6.3",
  },
  "ADD-PLAN-003": {
    category_major_id: "C4", category_minor_id: "C4_PLAN_ST", sub_class: "计划版本",
    role_scope_id: "ALL", source_section: "§5.5",
  },
  "ADD-PLAN-004": {
    category_major_id: "C4", category_minor_id: "C4_PLAN_ST", sub_class: "计划版本",
    role_scope_id: "ALL", source_section: "§5.5",
  },
  "ADD-TEMPLATE-001": {
    dimension_id: "A", category_major_id: "A6", category_minor_id: "A6_EVAL", sub_class: "用例规范",
    role_scope_id: "ALL", scheme_primary_id: "TS-10-MAN", scheme_secondary_id: null,
    validation_primary_id: "VS-02-CONTRACT", is_p0_blocker: true,
    tags: [ "A6", "ADD", "TEMPLATE", "P0-SPEC" ],
    source_section: "§7.3",
  },
};

/** @param {string} itemId */
function defaultOverride(itemId) {
  if (itemId.startsWith("ADD-EXEC-")) {
    return {
      category_major_id: "C1", category_minor_id: "C1_SUM", sub_class: "实际执行",
      role_scope_id: "COACH", scheme_primary_id: "TS-05-CHAIN",
      validation_primary_id: "VS-04-CHAIN-OK", tags: [ "C1", "ADD", "EXEC" ],
      scheme_mapping_source: "C1-方案映射.md",
    };
  }
  if (itemId.startsWith("ADD-IMPACT-")) {
    return {
      category_major_id: "C1", category_minor_id: "C1_IMPACT", sub_class: "AI影响分析",
      role_scope_id: "COACH", scheme_primary_id: "TS-02-BND",
      validation_primary_id: "VS-02-CONTRACT", tags: [ "C1", "ADD", "IMPACT" ],
      scheme_mapping_source: "scheme-map.json", source_section: "§4.9",
    };
  }
  return {
    category_major_id: "C1", category_minor_id: "C1_SUM", sub_class: "GENERAL",
    role_scope_id: "COACH", scheme_primary_id: "TS-05-CHAIN",
    validation_primary_id: "VS-04-CHAIN-OK", tags: [ "ADD" ],
    scheme_mapping_source: "scheme-map.json",
  };
}

/** @param {string} roleText */
function roleFromText(roleText) {
  if (/会员端/.test(roleText) && !/教练/.test(roleText)) return "MEMBER";
  if (/管理端/.test(roleText) && !/教练/.test(roleText)) return "MANAGER";
  if (/教练端\/管理端|教练端\/会员端|系统\/教练端/.test(roleText)) return "ALL";
  if (/教练端/.test(roleText)) return "COACH";
  return "ALL";
}

/** @param {string} line */
function parseMdLine(line) {
  const cols = line.split("\t");
  if (cols.length < 7) return null;
  const [ summary, roleText, purpose, input, expected, negatives, meta ] = cols;
  const itemId = meta.match(/原编号：([^；]+)/)?.[1]?.trim();
  if (!itemId) return null;
  const priority = meta.match(/优先级：(P\d)/)?.[1] || "P1";
  const prdRefs = parsePrdRefs(meta);
  const negativesList = negatives.split(/[；;]/).map((s) => s.trim()).filter(Boolean);
  const ov = { ...defaultOverride(itemId), ...(ITEM_OVERRIDES[itemId] || {}) };

  return {
    item_id: itemId,
    dimension_id: ov.dimension_id || "C",
    category_major_id: ov.category_major_id,
    category_minor_id: ov.category_minor_id,
    sub_class: ov.sub_class,
    item_name: `[${itemId}] ${summary.slice(0, 80)}`,
    detail_summary: summary.trim(),
    expected_observation: expected.trim(),
    test_input_example: input.trim() || null,
    preconditions: [
      roleText.includes("会员") ? "会员端已登录且品牌授权有效" : null,
      roleText.includes("教练") ? "教练端已登录；会员 session 已绑定" : null,
      roleText.includes("管理") ? "管理端账号具备查询权限" : null,
      "local 全栈或 AgentRun 环境可用",
    ].filter(Boolean),
    test_steps: [
      `场景：${purpose.trim()}`,
      `输入：${input.trim()}`,
      `观测：${expected.trim()}`,
    ],
    assertion_points: negativesList.length ? negativesList : [ expected.trim() ],
    priority_id: priority,
    prd_ref_id: prdRefs[0] || null,
    prd_ref_ids: prdRefs,
    arch_ref_id: null,
    arch_ref_ids: [],
    prd_goal_ids: priority === "P0" ? [ "G01" ] : [],
    automation_status_id: "AUTO_TODO",
    automation_entry_id: "AUTO_TODO_SCRIPT",
    automation_command: null,
    config_env: null,
    config_env_id: null,
    station_id: "NONE",
    role_scope_id: ov.role_scope_id || roleFromText(roleText),
    endpoint_path: null,
    http_method: null,
    http_status_expected: null,
    template_code: null,
    scheme_primary_id: ov.scheme_primary_id,
    scheme_secondary_id: ov.scheme_secondary_id ?? null,
    validation_primary_id: ov.validation_primary_id,
    validation_secondary_id: null,
    sample_execution_note: ov.sample_execution_note || "新用例.md 去重补充",
    scheme_mapping_source: ov.scheme_mapping_source || "scheme-map.json",
    is_risk_flag: ov.is_risk_flag ?? false,
    is_observability_audit: ov.is_observability_audit ?? false,
    is_p0_blocker: ov.is_p0_blocker ?? (priority === "P0"),
    failure_symptom: null,
    code_reference: null,
    tags: ov.tags || [ "ADD" ],
    notes: meta.trim(),
    source_doc: "新用例.md",
    source_section: ov.source_section || "ADD",
    is_active: true,
    exec_env_id: "EXEC_BOTH",
    env_tier_id: "TIER_STAGING",
    project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目",
  };
}

const NEW_PRD_REFS = [
  { prd_ref_id: "PRD_5_3", section: "§5.3", title: "会员状态", project_code: "fitness-agent" },
  { prd_ref_id: "PRD_5_5", section: "§5.5", title: "会员端训练计划确认", project_code: "fitness-agent" },
];

const NEW_PREFIXES = [
  { prefix: "ADD-MEMBER-COACH-", major: "C2", scheme: "TS-05-API", validation: "VS-07-RATE-H", note: "会员无教练风险反馈" },
  { prefix: "ADD-CONTEXT-", major: "C1", scheme: "TS-04-SET", validation: "VS-07-RATE-H", note: "评估上下文" },
  { prefix: "ADD-EXEC-", major: "C1", scheme: "TS-05-CHAIN", validation: "VS-04-CHAIN-OK", note: "实际执行解析" },
  { prefix: "ADD-ADOPT-", major: "C4", scheme: "TS-08-OBS", validation: "VS-05-PRESENCE", note: "采纳质量日志" },
  { prefix: "ADD-IMPACT-", major: "C1", scheme: "TS-02-BND", validation: "VS-02-CONTRACT", note: "AI影响分析" },
  { prefix: "ADD-PLAN-", major: "C4", scheme: "TS-02-BND", validation: "VS-02-CONTRACT", note: "计划版本规则" },
  { prefix: "ADD-TEMPLATE-", major: "A6", scheme: "TS-10-MAN", validation: "VS-02-CONTRACT", note: "P0用例规范" },
];

// ── parse md ──
const md = readFileSync(mdPath, "utf8");
const parsed = md.split(/\r?\n/).map(parseMdLine).filter(Boolean);
console.log(`Parsed ${parsed.length} items from 新用例.md`);

// ── merge test_item_detail ──
const rows = JSON.parse(readFileSync(dataFile, "utf8"));
const existingIds = new Set(rows.map((r) => r.item_id));
let added = 0;
for (const ni of parsed) {
  if (existingIds.has(ni.item_id)) {
    console.log(`SKIP exists: ${ni.item_id}`);
    continue;
  }
  rows.push(ni);
  existingIds.add(ni.item_id);
  added++;
}
writeFileSync(dataFile, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`Added ${added} items → total ${rows.length}`);

// ── regenerate init.sql ──
const ddlEnd = readFileSync(initSqlFile, "utf8").split("\n-- 数据导入")[0];
const insertLines = rows.filter((r) => r.is_active !== false).map((r) => {
  const filtered = {};
  for (const col of INSERT_COLUMNS) filtered[col] = r[col] ?? null;
  return buildInsertLine(filtered);
});
writeFileSync(initSqlFile, `${ddlEnd}\n-- 数据导入（${rows.length} 条）\n${insertLines.join("\n")}\n`, "utf8");
console.log(`Regenerated init.sql: ${insertLines.length} INSERTs`);

// ── category_major counts ──
const majors = JSON.parse(readFileSync(majorFile, "utf8"));
const countByMajor = {};
for (const r of rows.filter((x) => x.is_active !== false)) {
  countByMajor[r.category_major_id] = (countByMajor[r.category_major_id] || 0) + 1;
}
for (const m of majors) {
  if (countByMajor[m.category_major_id] !== undefined) m.item_count = countByMajor[m.category_major_id];
}
writeFileSync(majorFile, `${JSON.stringify(majors, null, 2)}\n`, "utf8");
let majorInit = readFileSync(majorInitFile, "utf8");
for (const m of majors) {
  const re = new RegExp(
    `(INSERT INTO test_category_major[^;]*'${m.category_major_id}'[^;]*item_count, default_scheme_id\\) VALUES \\('${m.category_major_id}', '[^']+', '[^']+', '[^']+', )\\d+`,
  );
  majorInit = majorInit.replace(re, `$1${m.item_count}`);
}
writeFileSync(majorInitFile, majorInit, "utf8");
console.log("Updated majors:", JSON.stringify(countByMajor));

// ── prd_reference ──
const prdRefs = JSON.parse(readFileSync(prdRefFile, "utf8"));
const prdIds = new Set(prdRefs.map((p) => p.prd_ref_id));
for (const ref of NEW_PRD_REFS) {
  if (!prdIds.has(ref.prd_ref_id)) {
    prdRefs.push(ref);
    const line = `INSERT INTO prd_reference (prd_ref_id, section, title, project_code) VALUES ('${ref.prd_ref_id}', '${ref.section}', '${ref.title}', '${ref.project_code}') ON CONFLICT (prd_ref_id) DO NOTHING;`;
    if (!readFileSync(prdRefInitFile, "utf8").includes(ref.prd_ref_id)) {
      writeFileSync(prdRefInitFile, `${readFileSync(prdRefInitFile, "utf8").trim()}\n${line}\n`, "utf8");
    }
  }
}
writeFileSync(prdRefFile, `${JSON.stringify(prdRefs, null, 2)}\n`, "utf8");

// ── prd_ref_link ──
const prdLinks = JSON.parse(readFileSync(prdLinkFile, "utf8"));
let linkNum = Math.max(...prdLinks.map((l) => Number(l.link_id.replace("PRL", ""))), 0);
const linkKey = new Set(prdLinks.map((l) => `${l.item_id}|${l.prd_ref_id}`));
for (const item of parsed) {
  for (const prdId of item.prd_ref_ids || []) {
    const key = `${item.item_id}|${prdId}`;
    if (linkKey.has(key)) continue;
    linkNum += 1;
    prdLinks.push({
      link_id: `PRL${String(linkNum).padStart(5, "0")}`,
      item_id: item.item_id,
      prd_ref_id: prdId,
      project_code: "fitness-agent",
    });
    linkKey.add(key);
  }
}
writeFileSync(prdLinkFile, `${JSON.stringify(prdLinks, null, 2)}\n`, "utf8");
const linkInserts = prdLinks.map((l) =>
  `INSERT INTO test_item_prd_ref_link (link_id, item_id, prd_ref_id, project_code) VALUES ('${l.link_id}', '${l.item_id}', '${l.prd_ref_id}', '${l.project_code}') ON CONFLICT (link_id) DO NOTHING;`,
);
const linkDdl = readFileSync(prdLinkInitFile, "utf8").split("\n-- 数据导入")[0];
writeFileSync(prdLinkInitFile, `${linkDdl}\n-- 数据导入（${prdLinks.length} 条）\n${linkInserts.join("\n")}\n`, "utf8");
console.log(`prd_ref_link: ${prdLinks.length} links`);

// ── prefix_scheme ──
const prefixes = JSON.parse(readFileSync(prefixFile, "utf8"));
let mapNum = Math.max(...prefixes.map((p) => Number(p.mapping_id.replace("MAP", ""))), 0);
const prefixSet = new Set(prefixes.map((p) => p.item_prefix));
for (const np of NEW_PREFIXES) {
  if (prefixSet.has(np.prefix)) continue;
  mapNum += 1;
  prefixes.push({
    mapping_id: `MAP${String(mapNum).padStart(4, "0")}`,
    item_prefix: np.prefix,
    scheme_primary_id: np.scheme,
    scheme_secondary_id: null,
    validation_primary_id: np.validation,
    validation_secondary_id: null,
    sample_execution_note: np.note,
    mapping_source: "新用例.md",
    project_code: "fitness-agent",
  });
}
writeFileSync(prefixFile, `${JSON.stringify(prefixes, null, 2)}\n`, "utf8");
const prefixInserts = prefixes.map((p) =>
  `INSERT INTO test_item_prefix_scheme (mapping_id, item_prefix, scheme_primary_id, scheme_secondary_id, validation_primary_id, validation_secondary_id, sample_execution_note, mapping_source) VALUES ('${p.mapping_id}', '${p.item_prefix}', '${p.scheme_primary_id}', ${p.scheme_secondary_id ? `'${p.scheme_secondary_id}'` : "NULL"}, '${p.validation_primary_id}', ${p.validation_secondary_id ? `'${p.validation_secondary_id}'` : "NULL"}, '${p.sample_execution_note}', '${p.mapping_source}') ON CONFLICT (mapping_id) DO NOTHING;`,
);
const prefixDdl = readFileSync(prefixInitFile, "utf8").split("\n-- 数据导入")[0];
writeFileSync(prefixInitFile, `${prefixDdl}\n-- 数据导入（${prefixes.length} 条）\n${prefixInserts.join("\n")}\n`, "utf8");

// ── 表说明 count ──
let doc = readFileSync(tableDocFile, "utf8");
doc = doc.replace(/共 \*\*\d+\*\* 条/, `共 **${rows.length}** 条`);
writeFileSync(tableDocFile, doc, "utf8");

console.log("\n完成。建议执行：");
console.log("  ams-testgen db:reset test_item_detail test_category_major prd_reference test_item_prd_ref_link test_item_prefix_scheme");
