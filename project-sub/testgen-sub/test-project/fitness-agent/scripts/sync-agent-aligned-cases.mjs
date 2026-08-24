#!/usr/bin/env node
/**
 * 对齐 .pi Agent（scene 围栏 / post-class-summary）与已纳入核心细节的 ADD-*：
 * - 补 C1-SCENE-001/002、C1-SUM-005
 * - 将 ADD-* 的 source_doc 从 新用例.md 改写为对应核心细节 md
 * - 全量重写 test_item_detail/init.sql
 *
 * Usage: node test-project/fitness-agent/scripts/sync-agent-aligned-cases.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const dataFile = join(root, "database/tables/test_item_detail/data.json");
const initSqlFile = join(root, "database/tables/test_item_detail/init.sql");
const majorFile = join(root, "database/tables/test_category_major/data.json");
const majorInitFile = join(root, "database/tables/test_category_major/init.sql");
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
  const vals = INSERT_COLUMNS.map((col) => sqlVal(row[col] ?? null));
  return `INSERT INTO test_item_detail (${INSERT_COLUMNS.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT (item_id) DO NOTHING;`;
}

/** @param {Partial<Record<string, unknown>> & { item_id: string }} base */
function item(base) {
  return {
    dimension_id: "C",
    category_major_id: "C1",
    preconditions: ["教练端已登录", "local 全栈或 AgentRun 环境可用", "请求携带正确 scene_code"],
    test_steps: ["准备场景前置", "提交教练 turn", "断言 message_type / 载荷 / 不得项"],
    assertion_points: [base.expected_observation],
    prd_ref_id: "PRD_4_1",
    prd_ref_ids: ["PRD_4_1"],
    arch_ref_id: "ARCH_B5",
    arch_ref_ids: ["ARCH_B5"],
    prd_goal_ids: base.priority_id === "P0" ? ["G01"] : [],
    automation_status_id: "AUTO_TODO",
    automation_entry_id: "AUTO_TODO_SCRIPT",
    automation_command: null,
    config_env: null,
    config_env_id: null,
    station_id: "NONE",
    role_scope_id: "COACH",
    endpoint_path: "/api/chat/turns/submit",
    http_method: "POST",
    http_status_expected: 202,
    template_code: null,
    scheme_primary_id: "TS-02-BND",
    scheme_secondary_id: null,
    validation_primary_id: "VS-02-CONTRACT",
    validation_secondary_id: null,
    sample_execution_note: "对齐 .pi sceneCode / AGENTS.md",
    scheme_mapping_source: "C1-方案映射.md",
    is_risk_flag: false,
    is_observability_audit: false,
    is_p0_blocker: base.priority_id === "P0",
    failure_symptom: null,
    code_reference: "fitness-agent/.pi/src/support/sceneCode.ts",
    tags: ["C1", "PI", "SCENE"],
    notes: "对齐 .pi workspaces-templates/coach + sceneCode 围栏",
    source_doc: "C1-教练端业务.md",
    is_active: true,
    exec_env_id: "EXEC_BOTH",
    env_tier_id: "TIER_STAGING",
    project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目",
    ...base,
  };
}

const AGENT_ITEMS = [
  item({
    item_id: "C1-SCENE-001",
    category_minor_id: "C1_ENTRY",
    sub_class: "coach_profile_chat",
    item_name: "[C1-SCENE-001] coach_profile_chat — 禁计划/课时/总结 UI",
    detail_summary: "个人简介场景请求生成计划/课时/总结",
    expected_observation: "仅 text；禁止 plan_form/session_plan/session_summary；allowedMessageTypes 硬拦",
    test_input_example: "scene_code=coach_profile_chat；输入：帮我给张三做个减脂计划",
    priority_id: "P0",
    source_section: "C1.12",
    test_steps: [
      "以 scene_code=coach_profile_chat 提交生成计划请求",
      "观测 outbox.message_type 与载荷",
      "断言不得出现 plan_form / session_plan / session_summary",
    ],
    assertion_points: [
      "message_type=text",
      "不得返回 plan_form_data / session_plan_data / session_summary",
      "不得声称已生成计划或课时",
    ],
  }),
  item({
    item_id: "C1-SCENE-002",
    category_minor_id: "C1_ENTRY",
    sub_class: "coach_ops_chat",
    item_name: "[C1-SCENE-002] coach_ops_chat — 允许完整业务 message_type",
    detail_summary: "运营主对话工作流",
    expected_observation: "允许完整业务 message_type（角色校验通过）；围栏内由 skill 决定任务",
    test_input_example: "scene_code=coach_ops_chat；已绑定会员；输入：给TA准备最近一节课",
    priority_id: "P1",
    is_p0_blocker: false,
    source_section: "C1.12",
    test_steps: [
      "以 scene_code=coach_ops_chat 提交课时生成意图",
      "观测可进入 require_form / session_plan 等工作流",
    ],
    assertion_points: [
      "允许业务 UI message_type（非仅 text 硬拦）",
      "仍须满足会员绑定与库内不变式",
    ],
  }),
  item({
    item_id: "C1-SUM-005",
    category_minor_id: "C1_SUM",
    sub_class: "课后总结",
    item_name: "[C1-SUM-005] Agent 态 active 才可总结",
    detail_summary: "仅 active 课时可 session_summary；completed/draft 禁止编造长文",
    expected_observation: "仅 status=active 可生成 session_summary；draft/completed 拒绝或澄清，不编造",
    test_input_example: "对 draft 或 completed 课时请求课后总结",
    priority_id: "P0",
    scheme_primary_id: "TS-05-CHAIN",
    validation_primary_id: "VS-04-CHAIN-OK",
    source_section: "C1.5",
    code_reference: "fitness-agent/.pi/workspaces-templates/coach/.pi/skills/post-class-summary/SKILL.md",
    tags: ["C1", "PI", "SUM"],
    notes: "对齐 .pi post-class-summary：仅 active（待上课）可总结",
    sample_execution_note: "对齐 post-class-summary skill 库内不变式",
    test_steps: [
      "准备 draft 课时请求总结 → 须先 commit，不得长文总结",
      "准备 active 课时请求总结 → 允许 session_summary 草稿",
      "准备 completed 课时请求总结 → 禁止编造新总结长文",
    ],
    assertion_points: [
      "draft：不得直接 session_summary 长文",
      "active：可 session_summary",
      "completed：不得编造新总结覆盖档案",
    ],
  }),
];

/** ADD-* → 已纳入的核心细节文档 */
const ADD_SOURCE_DOC = {
  "ADD-MEMBER-COACH-001": { source_doc: "C2-会员端业务.md", source_section: "C2.2" },
  "ADD-CONTEXT-003": { source_doc: "C1-教练端业务.md", source_section: "C1.7" },
  "ADD-CONTEXT-004": { source_doc: "C1-教练端业务.md", source_section: "C1.7" },
  "ADD-EXEC-001-R": { source_doc: "C1-教练端业务.md", source_section: "C1.5" },
  "ADD-EXEC-002-R": { source_doc: "C1-教练端业务.md", source_section: "C1.5" },
  "ADD-EXEC-003-R": { source_doc: "C1-教练端业务.md", source_section: "C1.5" },
  "ADD-EXEC-004-R": { source_doc: "C1-教练端业务.md", source_section: "C1.5" },
  "ADD-EXEC-005-R": { source_doc: "C1-教练端业务.md", source_section: "C1.1" },
  "ADD-EXEC-006-R": { source_doc: "C1-教练端业务.md", source_section: "C1.5" },
  "ADD-EXEC-008-R": { source_doc: "C1-教练端业务.md", source_section: "C1.5" },
  "ADD-EXEC-009-R": { source_doc: "C1-教练端业务.md", source_section: "C1.5" },
  "ADD-EXEC-011-R": { source_doc: "C1-教练端业务.md", source_section: "C1.5" },
  "ADD-EXEC-012-R": { source_doc: "C1-教练端业务.md", source_section: "C1.5" },
  "ADD-ADOPT-001": { source_doc: "C4-横切业务与状态机.md", source_section: "C4.8b" },
  "ADD-ADOPT-002": { source_doc: "C4-横切业务与状态机.md", source_section: "C4.8b" },
  "ADD-ADOPT-003": { source_doc: "C4-横切业务与状态机.md", source_section: "C4.8b" },
  "ADD-ADOPT-004": { source_doc: "C4-横切业务与状态机.md", source_section: "C4.8b" },
  "ADD-ADOPT-005": { source_doc: "C4-横切业务与状态机.md", source_section: "C4.8b" },
  "ADD-ADOPT-006": { source_doc: "C3-管理端业务.md", source_section: "C3.1" },
  "ADD-IMPACT-001": { source_doc: "C1-教练端业务.md", source_section: "C1.8" },
  "ADD-IMPACT-002": { source_doc: "C1-教练端业务.md", source_section: "C1.8" },
  "ADD-IMPACT-003": { source_doc: "C1-教练端业务.md", source_section: "C1.8" },
  "ADD-IMPACT-004": { source_doc: "C1-教练端业务.md", source_section: "C1.8" },
  "ADD-IMPACT-006": { source_doc: "C1-教练端业务.md", source_section: "C1.8" },
  "ADD-IMPACT-007": { source_doc: "C1-教练端业务.md", source_section: "C1.8" },
  "ADD-IMPACT-008": { source_doc: "C1-教练端业务.md", source_section: "C1.8" },
  "ADD-IMPACT-009": { source_doc: "C1-教练端业务.md", source_section: "C1.8" },
  "ADD-IMPACT-010": { source_doc: "C1-教练端业务.md", source_section: "C1.8" },
  "ADD-PLAN-003": { source_doc: "C4-横切业务与状态机.md", source_section: "C4.8c" },
  "ADD-PLAN-004": { source_doc: "C4-横切业务与状态机.md", source_section: "C4.8c" },
  "ADD-TEMPLATE-001": { source_doc: "A-测试层级.md", source_section: "A6" },
};

const rows = JSON.parse(readFileSync(dataFile, "utf8"));
const byId = new Map(rows.map((r) => [r.item_id, r]));

let added = 0;
for (const ni of AGENT_ITEMS) {
  if (byId.has(ni.item_id)) {
    Object.assign(byId.get(ni.item_id), ni);
    console.log(`UPDATE: ${ni.item_id}`);
  } else {
    rows.push(ni);
    byId.set(ni.item_id, ni);
    added++;
    console.log(`ADD: ${ni.item_id}`);
  }
}

let srcUpdated = 0;
for (const [id, meta] of Object.entries(ADD_SOURCE_DOC)) {
  const row = byId.get(id);
  if (!row) {
    console.warn(`WARN missing ADD item: ${id}`);
    continue;
  }
  if (row.source_doc !== meta.source_doc || row.source_section !== meta.source_section) {
    row.source_doc = meta.source_doc;
    row.source_section = meta.source_section;
    if (row.notes && String(row.notes).includes("原编号：")) {
      row.notes = `${row.notes}；已纳入 ${meta.source_doc} ${meta.source_section}`;
    }
    srcUpdated++;
  }
}

writeFileSync(dataFile, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`data.json: +${added} items, source_doc fixed ${srcUpdated}, total ${rows.length}`);

const ddlEnd = readFileSync(initSqlFile, "utf8").split("\n-- 数据导入")[0];
const insertLines = rows.filter((r) => r.is_active !== false).map((r) => {
  const filtered = {};
  for (const col of INSERT_COLUMNS) filtered[col] = r[col] ?? null;
  return buildInsertLine(filtered);
});
writeFileSync(initSqlFile, `${ddlEnd}\n-- 数据导入（${rows.length} 条）\n${insertLines.join("\n")}\n`, "utf8");
console.log(`init.sql: ${insertLines.length} INSERTs`);

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

let doc = readFileSync(tableDocFile, "utf8");
doc = doc.replace(/共 \*\*\d+\*\* 条/, `共 **${rows.length}** 条`);
doc = doc.replace(/> \d+ 条可执行测试项/, `> ${rows.length} 条可执行测试项`);
writeFileSync(tableDocFile, doc, "utf8");

console.log("\n完成。建议：ams-testgen db:reset test_item_detail test_category_major");
