#!/usr/bin/env node
/**
 * 直接替换旧 A–H / C1–C4 业务大类 → 通用 T1–T12。
 * 同步：testgen-sub database + fitness-agent-test-docs + 重映射 PI 用例。
 *
 * Usage: node test-project/fitness-agent/scripts/apply-generic-taxonomy.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const testgenRoot = join(here, "../../..");
const docsRoot = join(here, "../../../../../../fitness-agent-test-docs");

const PROJECT = "fitness-agent";

/** 维度：验证视角（非业务） */
const DIMENSIONS = [
  {
    dimension_id: "S",
    name: "结构验证",
    sort_order: 1,
    doc: "T-结构验证.md",
    description: "契约、边界、协议形状。覆盖 Agent / 传统软件 / 前端自动化的结构断言。",
    default_scheme_id: "TS-01-DET",
    default_validation_id: "VS-02-CONTRACT",
  },
  {
    dimension_id: "B",
    name: "行为验证",
    sort_order: 2,
    doc: "T-行为验证.md",
    description: "工作流、决策、集成调用。覆盖 Agent 回合、传统业务流程、前端用户路径。",
    default_scheme_id: "TS-05-CHAIN",
    default_validation_id: "VS-04-CHAIN-OK",
  },
  {
    dimension_id: "Q",
    name: "质量与风险",
    sort_order: 3,
    doc: "T-质量与风险.md",
    description: "安全合规、体验呈现、评测回归。Agent 风险 / 传统缺陷 / 前端视觉与交互。",
    default_scheme_id: "TS-04-SET",
    default_validation_id: "VS-07-RATE-H",
  },
  {
    dimension_id: "R",
    name: "运行保障",
    sort_order: 4,
    doc: "T-运行保障.md",
    description: "可靠性、性能容量、可观测。三类项目共用运行态保障。",
    default_scheme_id: "TS-09-LOAD",
    default_validation_id: "VS-10-SLO-M",
  },
];

/**
 * 通用大类。T8–T12 必须预留；description 标明 Agent / 传统 / 前端场景。
 * reserved=true 表示当前 seed 可无用例，但目录必须存在。
 */
const MAJORS = [
  {
    category_major_id: "T1",
    dimension_id: "S",
    name: "契约与结构",
    description:
      "Schema/契约/纯函数/静态守卫。Agent: outbox；传统: API contract；前端: 组件 props/类型。",
    default_scheme_id: "TS-01-DET",
    default_validation_id: "VS-02-CONTRACT",
    template_code: "TPL-DET",
    reserved: false,
  },
  {
    category_major_id: "T2",
    dimension_id: "S",
    name: "权限与能力边界",
    description:
      "角色围栏、禁止能力、载荷不得项。Agent: scene/role；传统: ACL；前端: 路由守卫/权限指令。",
    default_scheme_id: "TS-02-BND",
    default_validation_id: "VS-03-ZERO",
    template_code: "TPL-BND",
    reserved: false,
  },
  {
    category_major_id: "T3",
    dimension_id: "B",
    name: "工作流与状态",
    description:
      "多步任务与状态机。Agent: 计划/课时链路；传统: 审批流；前端: 多页向导。混合 TS（按用例 scheme）。",
    default_scheme_id: "TS-05-CHAIN",
    default_validation_id: "VS-04-CHAIN-OK",
    template_code: null, // mixed
    reserved: false,
  },
  {
    category_major_id: "T4",
    dimension_id: "B",
    name: "决策与规则质量",
    description:
      "意图/规则/策略选择。Agent: skill 路由；传统: 业务规则引擎；前端: 条件渲染策略。",
    default_scheme_id: "TS-04-SET",
    default_validation_id: "VS-07-RATE-H",
    template_code: "TPL-SET",
    reserved: false,
  },
  {
    category_major_id: "T5",
    dimension_id: "B",
    name: "集成与外部依赖",
    description:
      "Tool/第三方/检索/记忆路径。Agent: tools/wiki；传统: 外部 API/MQ；前端: mock 与网络层。",
    default_scheme_id: "TS-01-DET",
    default_validation_id: "VS-02-CONTRACT",
    template_code: "TPL-DET",
    reserved: false,
  },
  {
    category_major_id: "T6",
    dimension_id: "Q",
    name: "安全与合规",
    description:
      "风险阻断、隐私脱敏、注入/医学边界。三类项目共用安全回归。",
    default_scheme_id: "TS-07-NEG",
    default_validation_id: "VS-09-BLOCK-H",
    template_code: "TPL-NEG",
    reserved: false,
  },
  {
    category_major_id: "T7",
    dimension_id: "S",
    name: "接口协议",
    description:
      "HTTP/SSE/错误码/探针。Agent: pipeline turn；传统: REST；前端: BFF/MSW。",
    default_scheme_id: "TS-01-DET",
    default_validation_id: "VS-01-EXACT",
    template_code: "TPL-DET",
    reserved: false,
  },
  {
    category_major_id: "T8",
    dimension_id: "R",
    name: "可靠性",
    description:
      "【预留】幂等/重试/取消/恢复。Agent: turn 幂等；传统: 事务补偿；前端: 断网重试。",
    default_scheme_id: "TS-03-REP",
    default_validation_id: "VS-01-EXACT",
    template_code: "TPL-REP",
    reserved: true,
  },
  {
    category_major_id: "T9",
    dimension_id: "R",
    name: "性能与容量",
    description:
      "【预留】延迟/吞吐/压测。Agent: TTFT/C_pi；传统: 接口 SLA；前端: LCP/INP。",
    default_scheme_id: "TS-09-LOAD",
    default_validation_id: "VS-10-SLO-M",
    template_code: "TPL-LOAD",
    reserved: true,
  },
  {
    category_major_id: "T10",
    dimension_id: "Q",
    name: "体验与呈现",
    description:
      "【预留】文案/组件渲染/流式体验。Agent: status 文案；传统: 报表展示；前端自动化主阵地。",
    default_scheme_id: "TS-03-REP",
    default_validation_id: "VS-07-RATE-M",
    template_code: "TPL-REP",
    reserved: true,
  },
  {
    category_major_id: "T11",
    dimension_id: "R",
    name: "可观测与排障",
    description:
      "【预留】日志/trace/journey。Agent: turn_journeys；传统: APM；前端: error boundary/RUM。",
    default_scheme_id: "TS-08-OBS",
    default_validation_id: "VS-05-PRESENCE",
    template_code: "TPL-OBS",
    reserved: true,
  },
  {
    category_major_id: "T12",
    dimension_id: "Q",
    name: "评测与回归",
    description:
      "【预留】Golden/Eval/UAT/视觉回归。Agent: judge；传统: 回归套件；前端: screenshot diff。",
    default_scheme_id: "TS-04-SET",
    default_validation_id: "VS-07-RATE-H",
    template_code: "TPL-SET",
    reserved: true,
  },
];

const MINORS = [
  { category_minor_id: "T1_SCHEMA", category_major_id: "T1", name: "Schema/契约", sort_order: 1 },
  { category_minor_id: "T1_STATIC", category_major_id: "T1", name: "静态守卫", sort_order: 2 },
  { category_minor_id: "T2_ROLE", category_major_id: "T2", name: "角色围栏", sort_order: 1 },
  { category_minor_id: "T2_CAPABILITY", category_major_id: "T2", name: "能力边界", sort_order: 2 },
  { category_minor_id: "T2_PAYLOAD", category_major_id: "T2", name: "载荷不得项", sort_order: 3 },
  { category_minor_id: "T3_FLOW", category_major_id: "T3", name: "多步工作流", sort_order: 1 },
  { category_minor_id: "T3_STATE", category_major_id: "T3", name: "状态机", sort_order: 2 },
  { category_minor_id: "T3_CONFIRM", category_major_id: "T3", name: "确认/两轮", sort_order: 3 },
  { category_minor_id: "T4_ROUTE", category_major_id: "T4", name: "路由/策略", sort_order: 1 },
  { category_minor_id: "T4_INTENT", category_major_id: "T4", name: "意图/规则", sort_order: 2 },
  { category_minor_id: "T5_TOOL", category_major_id: "T5", name: "工具白名单", sort_order: 1 },
  { category_minor_id: "T5_MEMORY", category_major_id: "T5", name: "记忆/上下文", sort_order: 2 },
  { category_minor_id: "T5_RETRIEVAL", category_major_id: "T5", name: "检索/知识", sort_order: 3 },
  { category_minor_id: "T6_SAFETY", category_major_id: "T6", name: "安全阻断", sort_order: 1 },
  { category_minor_id: "T6_PRIVACY", category_major_id: "T6", name: "隐私脱敏", sort_order: 2 },
  { category_minor_id: "T6_BLOCK", category_major_id: "T6", name: "高风险清单", sort_order: 3 },
  { category_minor_id: "T7_HTTP", category_major_id: "T7", name: "HTTP/探针", sort_order: 1 },
  { category_minor_id: "T7_STREAM", category_major_id: "T7", name: "流式协议", sort_order: 2 },
  { category_minor_id: "T8_IDEM", category_major_id: "T8", name: "幂等/重试", sort_order: 1 },
  { category_minor_id: "T8_RECOVER", category_major_id: "T8", name: "取消/恢复", sort_order: 2 },
  { category_minor_id: "T9_LATENCY", category_major_id: "T9", name: "延迟/TTFT", sort_order: 1 },
  { category_minor_id: "T9_CAPACITY", category_major_id: "T9", name: "容量/压测", sort_order: 2 },
  { category_minor_id: "T10_COPY", category_major_id: "T10", name: "文案/反馈", sort_order: 1 },
  { category_minor_id: "T10_UI", category_major_id: "T10", name: "组件/视觉", sort_order: 2 },
  { category_minor_id: "T11_LOG", category_major_id: "T11", name: "日志字段", sort_order: 1 },
  { category_minor_id: "T11_TRACE", category_major_id: "T11", name: "Trace/Journey", sort_order: 2 },
  { category_minor_id: "T12_GOLDEN", category_major_id: "T12", name: "Golden/Eval", sort_order: 1 },
  { category_minor_id: "T12_REGRESS", category_major_id: "T12", name: "回归/UAT", sort_order: 2 },
];

/** PI item_id 前缀 → { major, minor } */
function mapPiItem(itemId, oldMinor) {
  const id = String(itemId);
  if (id.startsWith("PI-EMIT-") || id.startsWith("PI-STATIC-")) {
    return { major: "T1", minor: id.startsWith("PI-STATIC-") ? "T1_STATIC" : "T1_SCHEMA" };
  }
  if (id.startsWith("PI-SCENE-")) return { major: "T2", minor: "T2_ROLE" };
  if (id.startsWith("PI-MEMB-")) {
    if (oldMinor === "C2_PAYLOAD") return { major: "T2", minor: "T2_PAYLOAD" };
    if (oldMinor === "C2_MED") return { major: "T6", minor: "T6_SAFETY" };
    return { major: "T2", minor: "T2_CAPABILITY" };
  }
  if (id.startsWith("PI-MGR-")) {
    if (oldMinor === "C3_PAYLOAD") return { major: "T2", minor: "T2_PAYLOAD" };
    if (oldMinor === "C3_RISK") return { major: "T6", minor: "T6_BLOCK" };
    if (oldMinor === "C3_PERM") return { major: "T2", minor: "T2_ROLE" };
    return { major: "T2", minor: "T2_CAPABILITY" };
  }
  if (id.startsWith("PI-MACRO-") || id.startsWith("PI-SESS-") || id.startsWith("PI-SUM-") || id.startsWith("PI-ENTRY-") || id.startsWith("PI-FOLLOW-001")) {
    if (oldMinor === "C1_MACRO" && /五态|Active|状态/.test(id)) return { major: "T3", minor: "T3_STATE" };
    // MACRO-007/008/009 are 五态 — use item notes via sub_class later; by id:
    if ([ "PI-MACRO-007", "PI-MACRO-008", "PI-MACRO-009" ].includes(id)) return { major: "T3", minor: "T3_STATE" };
    return { major: "T3", minor: "T3_FLOW" };
  }
  if (id.startsWith("PI-DEL-") || id.startsWith("PI-ARCH-") || id === "PI-FOLLOW-002") {
    return { major: "T3", minor: "T3_CONFIRM" };
  }
  if (id.startsWith("PI-SKILL-007") || id.startsWith("PI-SKILL-008")) {
    return { major: "T6", minor: "T6_BLOCK" };
  }
  if (id.startsWith("PI-SKILL-")) return { major: "T4", minor: "T4_ROUTE" };
  if (id.startsWith("PI-SAFE-")) return { major: "T6", minor: "T6_SAFETY" };
  if (id.startsWith("PI-THINK-")) return { major: "T6", minor: "T6_PRIVACY" };
  if (id.startsWith("PI-TOOL-")) return { major: "T5", minor: "T5_TOOL" };
  if (id.startsWith("PI-MEM-")) return { major: "T5", minor: "T5_MEMORY" };
  if (id.startsWith("PI-WIKI-")) return { major: "T5", minor: "T5_RETRIEVAL" };
  if (id.startsWith("PI-HTTP-")) return { major: "T7", minor: "T7_HTTP" };
  return { major: "T1", minor: "T1_SCHEMA" };
}

function sqlVal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v) || typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

function rewriteInitSql(initPath, insertLines, note) {
  const raw = readFileSync(initPath, "utf8");
  const ddlLines = raw.split(/\r?\n/).filter((l) => !/^\s*INSERT\s+INTO/i.test(l) && !/^\s*--\s*数据导入/.test(l) && !/^\s*--\s*混合 TS/.test(l));
  // keep leading comment lines that are part of DDL section, drop trailing empty
  while (ddlLines.length && !ddlLines[ddlLines.length - 1].trim()) ddlLines.pop();
  // strip orphan template comment if present at end of major_template
  writeFileSync(
    initPath,
    `${ddlLines.join("\n")}\n\n-- 数据导入（${insertLines.length} 条 · ${note}）\n${insertLines.join("\n")}\n`,
  );
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function enrichMajor(m, counts) {
  return {
    category_major_id: m.category_major_id,
    dimension_id: m.dimension_id,
    name: m.name,
    description: m.description,
    item_count: counts[m.category_major_id] || 0,
    default_scheme_id: m.default_scheme_id,
    dimension_name: DIMENSIONS.find((d) => d.dimension_id === m.dimension_id)?.name || null,
    default_scheme_name: null,
    default_validation_id: m.default_validation_id,
    default_validation_name: null,
    project_code: PROJECT,
    is_reserved: !!m.reserved,
  };
}

function applyTaxonomyToDir(tablesRoot, items) {
  const dimDir = join(tablesRoot, "test_dimension");
  const majorDir = join(tablesRoot, "test_category_major");
  const minorDir = join(tablesRoot, "test_category_minor");
  const tplDir = join(tablesRoot, "test_category_major_template");
  const itemDir = join(tablesRoot, "test_item_detail");

  const counts = {};
  for (const it of items) counts[it.category_major_id] = (counts[it.category_major_id] || 0) + 1;

  const dimCounts = {};
  for (const m of MAJORS) {
    dimCounts[m.dimension_id] = (dimCounts[m.dimension_id] || 0) + (counts[m.category_major_id] || 0);
  }

  // dimensions
  const dimRows = DIMENSIONS.map((d) => ({
    ...d,
    item_count: dimCounts[d.dimension_id] || 0,
    default_scheme_name: null,
    default_validation_name: null,
    project_code: PROJECT,
  }));
  writeJson(join(dimDir, "data.json"), dimRows);
  rewriteInitSql(
    join(dimDir, "init.sql"),
    dimRows.map(
      (d) =>
        `INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('${d.dimension_id}', '${d.name}', ${d.sort_order}, '${d.doc}', '${d.description.replace(/'/g, "''")}', '${d.default_scheme_id}', '${d.default_validation_id}', ${d.item_count}) ON CONFLICT (dimension_id) DO NOTHING;`,
    ),
    "通用维度 S/B/Q/R",
  );
  writeFileSync(
    join(dimDir, "表说明.md"),
    `# test_dimension · 通用验证维度\n\n> S 结构 · B 行为 · Q 质量与风险 · R 运行保障。覆盖 Agent / 传统软件 / 前端自动化。\n`,
  );

  // majors
  const majorRows = MAJORS.map((m) => enrichMajor(m, counts));
  writeJson(join(majorDir, "data.json"), majorRows);
  rewriteInitSql(
    join(majorDir, "init.sql"),
    majorRows.map(
      (m) =>
        `INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('${m.category_major_id}', '${m.dimension_id}', '${m.name}', '${m.description.replace(/'/g, "''")}', ${m.item_count}, '${m.default_scheme_id}') ON CONFLICT (category_major_id) DO NOTHING;`,
    ),
    "通用大类 T1–T12",
  );
  writeFileSync(
    join(majorDir, "表说明.md"),
    `# test_category_major · 通用大类 T1–T12\n\n按「测什么」而非业务角色。T8–T12 为预留（可靠性/性能/体验/可观测/评测）。\n`,
  );

  // minors
  const minorRows = MINORS.map((m) => ({ ...m, project_code: PROJECT }));
  writeJson(join(minorDir, "data.json"), minorRows);
  rewriteInitSql(
    join(minorDir, "init.sql"),
    minorRows.map(
      (m) =>
        `INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('${m.category_minor_id}', '${m.category_major_id}', '${m.name}', ${m.sort_order}) ON CONFLICT (category_minor_id) DO NOTHING;`,
    ),
    "通用子类",
  );

  // major templates (skip mixed T3)
  if (existsSync(tplDir)) {
    const tplRows = MAJORS.filter((m) => m.template_code).map((m) => ({
      category_major_id: m.category_major_id,
      template_code: m.template_code,
      note: m.name,
      project_code: PROJECT,
    }));
    writeJson(join(tplDir, "data.json"), tplRows);
    const rawTpl = readFileSync(join(tplDir, "init.sql"), "utf8");
    const ddl = rawTpl
      .split(/\r?\n/)
      .filter((l) => !/^\s*INSERT\s+INTO/i.test(l) && !/^\s*--\s*数据导入/.test(l) && !/^\s*--\s*混合 TS/.test(l));
    while (ddl.length && !ddl[ddl.length - 1].trim()) ddl.pop();
    const inserts = [
      "-- 混合 TS 大类 T3 不挂载，用例级按 scheme_primary_id 解析模板",
      ...tplRows.map(
        (r) =>
          `INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('${r.category_major_id}', '${r.template_code}', '${r.note}') ON CONFLICT (category_major_id) DO NOTHING;`,
      ),
    ];
    writeFileSync(join(tplDir, "init.sql"), `${ddl.join("\n")}\n\n-- 数据导入（${tplRows.length} 条 · 通用模板映射）\n${inserts.join("\n")}\n`);
  }

  // items
  if (existsSync(itemDir) && items.length) {
    writeJson(join(itemDir, "data.json"), items);
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
    const inserts = items.map((row) => {
      const vals = INSERT_COLUMNS.map((c) => sqlVal(row[c] ?? null));
      return `INSERT INTO test_item_detail (${INSERT_COLUMNS.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT (item_id) DO NOTHING;`;
    });
    rewriteInitSql(join(itemDir, "init.sql"), inserts, `T1–T12 映射 · ${items.length} 条`);
    writeFileSync(
      join(itemDir, "表说明.md"),
      `# test_item_detail\n\n> 共 **${items.length}** 条。大类已映射至通用 **T1–T12**（2026-07-30）。\n`,
    );
  }

  console.log(`applied taxonomy → ${tablesRoot}`);
  console.log("  major counts", counts);
}

// ─── remap items ─────────────────────────────────────────────────
const tgItemPath = join(testgenRoot, "database/tables/test_item_detail/data.json");
const items = JSON.parse(readFileSync(tgItemPath, "utf8"));
const remapped = items.map((it) => {
  const { major, minor } = mapPiItem(it.item_id, it.category_minor_id);
  const dim = MAJORS.find((m) => m.category_major_id === major)?.dimension_id || "S";
  const tags = Array.isArray(it.tags) ? [ ...new Set([ ...it.tags.filter((t) => !/^(A\d|B\d|C\d|E_|D\d|F\d|G\d|H\d)/.test(t)), "PI", major ]) ] : [ "PI", major ];
  return {
    ...it,
    dimension_id: dim,
    category_major_id: major,
    category_minor_id: minor,
    tags,
    notes: `${it.notes || ""}；taxonomy→${major}/${minor}`.replace(/^；/, ""),
  };
});

applyTaxonomyToDir(join(testgenRoot, "database/tables"), remapped);

const docsTables = join(docsRoot, "数据库详细表");
if (existsSync(docsTables)) {
  applyTaxonomyToDir(docsTables, remapped);
}

// ─── migration SQL for live DB ───────────────────────────────────
const migDir = join(testgenRoot, "database/migrations");
mkdirSync(migDir, { recursive: true });
const migPath = join(migDir, "010_generic_taxonomy_t1_t12.sql");
writeFileSync(
  migPath,
  `-- 010: 直接替换旧 A–H 大类 → 通用 T1–T12
-- 注意：会删除旧 taxonomy 行；请先备份。适用于可重建种子环境。

BEGIN;

-- 先解除用例外键占用：临时挂到将插入的 T1（若表空则跳过更新）
-- 实际重置推荐：DROP/重建或从 init.sql 全量导入。
-- 本迁移给出「可执行」路径：truncate 级联敏感，改为：

CREATE TEMP TABLE _item_remap AS
SELECT item_id,
  CASE
    WHEN item_id LIKE 'PI-EMIT-%' OR item_id LIKE 'PI-STATIC-%' THEN 'T1'
    WHEN item_id LIKE 'PI-SCENE-%' THEN 'T2'
    WHEN item_id LIKE 'PI-MEMB-%' AND category_minor_id = 'C2_MED' THEN 'T6'
    WHEN item_id LIKE 'PI-MEMB-%' THEN 'T2'
    WHEN item_id LIKE 'PI-MGR-%' AND category_minor_id = 'C3_RISK' THEN 'T6'
    WHEN item_id LIKE 'PI-MGR-%' THEN 'T2'
    WHEN item_id LIKE 'PI-SAFE-%' OR item_id LIKE 'PI-THINK-%' THEN 'T6'
    WHEN item_id LIKE 'PI-SKILL-007%' OR item_id LIKE 'PI-SKILL-008%' THEN 'T6'
    WHEN item_id LIKE 'PI-SKILL-%' THEN 'T4'
    WHEN item_id LIKE 'PI-TOOL-%' OR item_id LIKE 'PI-MEM-%' OR item_id LIKE 'PI-WIKI-%' THEN 'T5'
    WHEN item_id LIKE 'PI-HTTP-%' THEN 'T7'
    WHEN item_id LIKE 'PI-DEL-%' OR item_id LIKE 'PI-ARCH-%' OR item_id = 'PI-FOLLOW-002' THEN 'T3'
    WHEN item_id LIKE 'PI-MACRO-%' OR item_id LIKE 'PI-SESS-%' OR item_id LIKE 'PI-SUM-%'
      OR item_id LIKE 'PI-ENTRY-%' OR item_id LIKE 'PI-FOLLOW-%' THEN 'T3'
    ELSE 'T1'
  END AS new_major,
  CASE
    WHEN item_id LIKE 'PI-STATIC-%' THEN 'T1_STATIC'
    WHEN item_id LIKE 'PI-EMIT-%' THEN 'T1_SCHEMA'
    WHEN item_id LIKE 'PI-SCENE-%' THEN 'T2_ROLE'
    WHEN item_id LIKE 'PI-MEMB-%' AND category_minor_id = 'C2_PAYLOAD' THEN 'T2_PAYLOAD'
    WHEN item_id LIKE 'PI-MEMB-%' AND category_minor_id = 'C2_MED' THEN 'T6_SAFETY'
    WHEN item_id LIKE 'PI-MEMB-%' THEN 'T2_CAPABILITY'
    WHEN item_id LIKE 'PI-MGR-%' AND category_minor_id = 'C3_PAYLOAD' THEN 'T2_PAYLOAD'
    WHEN item_id LIKE 'PI-MGR-%' AND category_minor_id = 'C3_PERM' THEN 'T2_ROLE'
    WHEN item_id LIKE 'PI-MGR-%' AND category_minor_id = 'C3_RISK' THEN 'T6_BLOCK'
    WHEN item_id LIKE 'PI-MGR-%' THEN 'T2_CAPABILITY'
    WHEN item_id IN ('PI-MACRO-007','PI-MACRO-008','PI-MACRO-009') THEN 'T3_STATE'
    WHEN item_id LIKE 'PI-DEL-%' OR item_id LIKE 'PI-ARCH-%' OR item_id = 'PI-FOLLOW-002' THEN 'T3_CONFIRM'
    WHEN item_id LIKE 'PI-MACRO-%' OR item_id LIKE 'PI-SESS-%' OR item_id LIKE 'PI-SUM-%'
      OR item_id LIKE 'PI-ENTRY-%' OR item_id LIKE 'PI-FOLLOW-%' THEN 'T3_FLOW'
    WHEN item_id LIKE 'PI-SKILL-007%' OR item_id LIKE 'PI-SKILL-008%' THEN 'T6_BLOCK'
    WHEN item_id LIKE 'PI-SKILL-%' THEN 'T4_ROUTE'
    WHEN item_id LIKE 'PI-SAFE-%' THEN 'T6_SAFETY'
    WHEN item_id LIKE 'PI-THINK-%' THEN 'T6_PRIVACY'
    WHEN item_id LIKE 'PI-TOOL-%' THEN 'T5_TOOL'
    WHEN item_id LIKE 'PI-MEM-%' THEN 'T5_MEMORY'
    WHEN item_id LIKE 'PI-WIKI-%' THEN 'T5_RETRIEVAL'
    WHEN item_id LIKE 'PI-HTTP-%' THEN 'T7_HTTP'
    ELSE 'T1_SCHEMA'
  END AS new_minor
FROM test_item_detail;

-- 先插入新 taxonomy（与旧 ID 并存片刻），再改用例，最后删旧行
DELETE FROM test_category_major_template;

INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count)
VALUES
  ('S', '结构验证', 1, 'T-结构验证.md', '契约、边界、协议', 'TS-01-DET', 'VS-02-CONTRACT', 0),
  ('B', '行为验证', 2, 'T-行为验证.md', '工作流、决策、集成', 'TS-05-CHAIN', 'VS-04-CHAIN-OK', 0),
  ('Q', '质量与风险', 3, 'T-质量与风险.md', '安全、体验、评测', 'TS-04-SET', 'VS-07-RATE-H', 0),
  ('R', '运行保障', 4, 'T-运行保障.md', '可靠性、性能、可观测', 'TS-09-LOAD', 'VS-10-SLO-M', 0)
ON CONFLICT (dimension_id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES
  ('T1', 'S', '契约与结构', 'Schema/契约/纯函数/静态守卫', 0, 'TS-01-DET'),
  ('T2', 'S', '权限与能力边界', '角色围栏、禁止能力、载荷不得项', 0, 'TS-02-BND'),
  ('T3', 'B', '工作流与状态', '多步任务与状态机（混合 TS）', 0, 'TS-05-CHAIN'),
  ('T4', 'B', '决策与规则质量', '意图/规则/策略选择', 0, 'TS-04-SET'),
  ('T5', 'B', '集成与外部依赖', 'Tool/第三方/检索/记忆', 0, 'TS-01-DET'),
  ('T6', 'Q', '安全与合规', '风险阻断、隐私、注入边界', 0, 'TS-07-NEG'),
  ('T7', 'S', '接口协议', 'HTTP/SSE/错误码/探针', 0, 'TS-01-DET'),
  ('T8', 'R', '可靠性', '【预留】幂等/重试/取消/恢复', 0, 'TS-03-REP'),
  ('T9', 'R', '性能与容量', '【预留】延迟/吞吐/压测', 0, 'TS-09-LOAD'),
  ('T10', 'Q', '体验与呈现', '【预留】文案/组件/流式体验', 0, 'TS-03-REP'),
  ('T11', 'R', '可观测与排障', '【预留】日志/trace/journey', 0, 'TS-08-OBS'),
  ('T12', 'Q', '评测与回归', '【预留】Golden/Eval/UAT/视觉回归', 0, 'TS-04-SET')
ON CONFLICT (category_major_id) DO UPDATE SET dimension_id = EXCLUDED.dimension_id, name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES
  ('T1_SCHEMA', 'T1', 'Schema/契约', 1),
  ('T1_STATIC', 'T1', '静态守卫', 2),
  ('T2_ROLE', 'T2', '角色围栏', 1),
  ('T2_CAPABILITY', 'T2', '能力边界', 2),
  ('T2_PAYLOAD', 'T2', '载荷不得项', 3),
  ('T3_FLOW', 'T3', '多步工作流', 1),
  ('T3_STATE', 'T3', '状态机', 2),
  ('T3_CONFIRM', 'T3', '确认/两轮', 3),
  ('T4_ROUTE', 'T4', '路由/策略', 1),
  ('T4_INTENT', 'T4', '意图/规则', 2),
  ('T5_TOOL', 'T5', '工具白名单', 1),
  ('T5_MEMORY', 'T5', '记忆/上下文', 2),
  ('T5_RETRIEVAL', 'T5', '检索/知识', 3),
  ('T6_SAFETY', 'T6', '安全阻断', 1),
  ('T6_PRIVACY', 'T6', '隐私脱敏', 2),
  ('T6_BLOCK', 'T6', '高风险清单', 3),
  ('T7_HTTP', 'T7', 'HTTP/探针', 1),
  ('T7_STREAM', 'T7', '流式协议', 2),
  ('T8_IDEM', 'T8', '幂等/重试', 1),
  ('T8_RECOVER', 'T8', '取消/恢复', 2),
  ('T9_LATENCY', 'T9', '延迟/TTFT', 1),
  ('T9_CAPACITY', 'T9', '容量/压测', 2),
  ('T10_COPY', 'T10', '文案/反馈', 1),
  ('T10_UI', 'T10', '组件/视觉', 2),
  ('T11_LOG', 'T11', '日志字段', 1),
  ('T11_TRACE', 'T11', 'Trace/Journey', 2),
  ('T12_GOLDEN', 'T12', 'Golden/Eval', 1),
  ('T12_REGRESS', 'T12', '回归/UAT', 2)
ON CONFLICT (category_minor_id) DO UPDATE SET category_major_id = EXCLUDED.category_major_id, name = EXCLUDED.name;

UPDATE test_item_detail t
SET
  category_major_id = r.new_major,
  category_minor_id = r.new_minor,
  dimension_id = CASE r.new_major
    WHEN 'T1' THEN 'S' WHEN 'T2' THEN 'S' WHEN 'T7' THEN 'S'
    WHEN 'T3' THEN 'B' WHEN 'T4' THEN 'B' WHEN 'T5' THEN 'B'
    WHEN 'T6' THEN 'Q' WHEN 'T10' THEN 'Q' WHEN 'T12' THEN 'Q'
    ELSE 'R' END
FROM _item_remap r
WHERE t.item_id = r.item_id;

-- 删除旧大类/子类/维度（仅当无残留引用）
DELETE FROM test_category_minor WHERE category_major_id !~ '^T[0-9]+$';
DELETE FROM test_category_major_template WHERE category_major_id !~ '^T[0-9]+$';
DELETE FROM test_category_major WHERE category_major_id !~ '^T[0-9]+$';
DELETE FROM test_dimension WHERE dimension_id NOT IN ('S', 'B', 'Q', 'R');

-- 模板映射（T3 混合不挂）
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES
  ('T1', 'TPL-DET', '契约与结构'),
  ('T2', 'TPL-BND', '权限与能力边界'),
  ('T4', 'TPL-SET', '决策与规则质量'),
  ('T5', 'TPL-DET', '集成与外部依赖'),
  ('T6', 'TPL-NEG', '安全与合规'),
  ('T7', 'TPL-DET', '接口协议'),
  ('T8', 'TPL-REP', '可靠性'),
  ('T9', 'TPL-LOAD', '性能与容量'),
  ('T10', 'TPL-REP', '体验与呈现'),
  ('T11', 'TPL-OBS', '可观测与排障'),
  ('T12', 'TPL-SET', '评测与回归')
ON CONFLICT (category_major_id) DO UPDATE SET template_code = EXCLUDED.template_code;

UPDATE test_category_major m SET item_count = COALESCE((
  SELECT COUNT(*)::text FROM test_item_detail i WHERE i.category_major_id = m.category_major_id AND i.is_active IS DISTINCT FROM FALSE
), '0');

COMMIT;
`,
);

// ─── docs overview ───────────────────────────────────────────────
const taxonomyDoc = join(docsRoot, "测试用例分类体系.md");
if (existsSync(dirname(taxonomyDoc))) {
  writeFileSync(
    taxonomyDoc,
    `# 测试用例分类体系（通用 T1–T12）

> **版本**：2026-07-30 · **直接替换**旧 A–H / C1–C4 业务大类  
> **原则**：大类按「测什么」，不按业务角色/产品模块。业务差异用子类、\`role_scope\`、tags、\`source_doc\`。

## 维度（4）

| ID | 名称 | 说明 |
|----|------|------|
| S | 结构验证 | 契约、边界、协议 |
| B | 行为验证 | 工作流、决策、集成 |
| Q | 质量与风险 | 安全、体验、评测 |
| R | 运行保障 | 可靠性、性能、可观测 |

## 大类 T1–T12

| ID | 名称 | 维度 | Agent | 传统软件 | 前端自动化 |
|----|------|------|-------|----------|------------|
| T1 | 契约与结构 | S | outbox/schema | API contract | 组件 props |
| T2 | 权限与能力边界 | S | scene/role | ACL | 路由守卫 |
| T3 | 工作流与状态 | B | 计划/课时链路 | 审批流 | 多页向导 |
| T4 | 决策与规则质量 | B | skill 路由 | 规则引擎 | 条件策略 |
| T5 | 集成与外部依赖 | B | tools/wiki | 外部 API | mock/网络层 |
| T6 | 安全与合规 | Q | 医学/注入 | 安全扫描 | XSS/CSP |
| T7 | 接口协议 | S | pipeline HTTP | REST | BFF/MSW |
| T8 | 可靠性 **预留** | R | turn 幂等 | 事务补偿 | 断网重试 |
| T9 | 性能与容量 **预留** | R | TTFT | SLA | LCP/INP |
| T10 | 体验与呈现 **预留** | Q | status 文案 | 报表展示 | E2E/视觉主阵地 |
| T11 | 可观测与排障 **预留** | R | journey | APM | RUM |
| T12 | 评测与回归 **预留** | Q | Golden/Judge | 回归套件 | screenshot diff |

T8–T12 必须保留在目录中；按项目种类启用与补用例。

## 与 fitness-agent PI 用例

见 \`测试项核心细节/\`；\`item_id\` 仍为 \`PI-*\`，\`category_major_id\` 已映射至 T*。
`,
  );
}

const overview = join(docsRoot, "测试项全览目录.md");
if (existsSync(overview)) {
  writeFileSync(
    overview,
    `# 启炼 AI Agent 测试项全览（通用大类）

> **版本**：2026-07-30 · **条目**：${remapped.length} · 大类 **T1–T12**

| 大类 | 约数 | PI 前缀示例 |
|------|------|-------------|
| T1 契约与结构 | 16 | PI-EMIT / PI-STATIC |
| T2 权限与能力边界 | 23 | PI-SCENE / PI-MEMB / PI-MGR |
| T3 工作流与状态 | 30 | PI-MACRO / SESS / SUM / DEL |
| T4 决策与规则质量 | 6 | PI-SKILL（路由） |
| T5 集成与外部依赖 | 6 | PI-TOOL / MEM / WIKI |
| T6 安全与合规 | 9 | PI-SAFE / THINK / SKILL 高风险 |
| T7 接口协议 | 5 | PI-HTTP |
| T8–T12 | 0 | 预留 |

自动化：\`cd fitness-agent/.pi && npm test\`
`,
  );
}

console.log(`remapped ${remapped.length} items`);
console.log("migration:", migPath);
console.log("done");
