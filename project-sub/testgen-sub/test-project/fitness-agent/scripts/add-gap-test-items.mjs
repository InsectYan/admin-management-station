#!/usr/bin/env node
/**
 * 补充 PRD 邀请/授权、A3 HTTP、B_REL 可靠性、A4 E2E 缺口测试项，
 * 并全量重写 test_item_detail/init.sql INSERT 段。
 * Usage: node test-project/fitness-agent/scripts/add-gap-test-items.mjs
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
const minorFile = join(root, "database/tables/test_category_minor/data.json");
const minorInitFile = join(root, "database/tables/test_category_minor/init.sql");
const prdRefFile = join(root, "database/tables/prd_reference/data.json");
const prdRefInitFile = join(root, "database/tables/prd_reference/init.sql");

const INSERT_COLUMNS = [
  "item_id", "dimension_id", "category_major_id", "category_minor_id", "sub_class",
  "item_name", "detail_summary", "expected_observation", "test_input_example",
  "preconditions", "test_steps", "assertion_points", "priority_id",
  "prd_ref_id", "prd_ref_ids", "arch_ref_id", "arch_ref_ids", "prd_goal_ids",
  "automation_status_id", "automation_entry_id", "automation_command",
  "config_env", "config_env_id", "station_id", "role_scope_id",
  "endpoint_path", "http_method", "http_status_expected",
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

/** @param {Partial<Record<string, unknown>> & { item_id: string }} base */
function item(base) {
  return {
    dimension_id: "C",
    category_major_id: "C4",
    category_minor_id: "C4_INVITE",
    preconditions: ["邀请功能已实现且测试环境含品牌/门店/教练种子"],
    test_steps: ["准备场景", "执行邀请/扫码/授权流程", "断言预期结果"],
    assertion_points: [base.expected_observation],
    prd_ref_id: "PRD_INV_5",
    prd_ref_ids: [base.prd_ref_id || "PRD_INV_5"],
    arch_ref_ids: [],
    prd_goal_ids: [],
    automation_status_id: "AUTO_TODO",
    automation_entry_id: "AUTO_TODO_SCRIPT",
    automation_command: null,
    config_env: null,
    config_env_id: null,
    station_id: "NONE",
    endpoint_path: null,
    http_method: null,
    http_status_expected: null,
    scheme_primary_id: "TS-05-CHAIN",
    scheme_secondary_id: null,
    validation_primary_id: "VS-04-CHAIN-OK",
    validation_secondary_id: null,
    sample_execution_note: "多步邀请授权链路",
    scheme_mapping_source: "scheme-map.json",
    is_risk_flag: false,
    is_observability_audit: false,
    is_p0_blocker: base.priority_id === "P0",
    failure_symptom: null,
    code_reference: null,
    tags: ["C4", "INVITE", "PRD_INV"],
    notes: "PRD文档.md 邀请授权专项 · MVP 功能待 fitness-agent 落地",
    source_doc: "PRD文档.md",
    is_active: true,
    exec_env_id: "EXEC_BOTH",
    env_tier_id: "TIER_STAGING",
    project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目",
    ...base,
  };
}

const NEW_ITEMS = [
  // ── C4 邀请与授权（PRD文档.md）──
  item({
    item_id: "C4-INVITE-001", sub_class: "管理端邀请", role_scope_id: "MANAGER",
    item_name: "[C4-INVITE-001] 管理端邀请 — 新会员进公海",
    detail_summary: "门店管理端生成邀请码，新会员扫码授权",
    expected_observation: "创建主档+品牌授权+门店承接，默认进该门店公海",
    test_input_example: "管理端邀请码 → 会员扫码 → 登录 → 确认授权品牌",
    priority_id: "P0", prd_ref_id: "PRD_INV_5", source_section: "§5",
    test_steps: ["管理端生成邀请码", "新会员扫码并完成授权", "查门店会员列表"],
  }),
  item({
    item_id: "C4-INVITE-002", sub_class: "管理端邀请", role_scope_id: "MANAGER",
    item_name: "[C4-INVITE-002] 管理端邀请 — 已是门店会员再扫码",
    detail_summary: "已是该门店公海/体验/在服会员再次扫码",
    expected_observation: "原身份不变，不退回公海、不降级",
    priority_id: "P0", prd_ref_id: "PRD_INV_5", source_section: "§5.3",
  }),
  item({
    item_id: "C4-INVITE-003", sub_class: "管理端邀请", role_scope_id: "MANAGER",
    item_name: "[C4-INVITE-003] 管理端邀请 — 不自动分配教练",
    detail_summary: "管理端邀请成功后",
    expected_observation: "不建立教练服务关系，教练端不可见该会员",
    priority_id: "P1", prd_ref_id: "PRD_INV_5", source_section: "§5.4",
  }),
  item({
    item_id: "C4-INVITE-004", sub_class: "品牌教练邀请", role_scope_id: "COACH",
    item_name: "[C4-INVITE-004] 教练邀请 — 新会员体验关系",
    detail_summary: "品牌教练生成邀请码，新会员扫码",
    expected_observation: "品牌授权+门店承接+邀请教练体验服务关系",
    priority_id: "P0", prd_ref_id: "PRD_INV_6", source_section: "§6",
    test_steps: ["教练端生成邀请码", "新会员扫码授权", "查教练体验会员列表"],
  }),
  item({
    item_id: "C4-INVITE-005", sub_class: "品牌教练邀请", role_scope_id: "MEMBER",
    item_name: "[C4-INVITE-005] 教练邀请 — 授权对象是品牌",
    detail_summary: "会员查看教练邀请授权页文案",
    expected_observation: "表达为授权品牌由该教练承接体验，非授权教练个人",
    priority_id: "P0", prd_ref_id: "PRD_INV_6", source_section: "§6.2",
    scheme_primary_id: "TS-06-PAIR", validation_primary_id: "VS-03-ZERO",
  }),
  item({
    item_id: "C4-INVITE-006", sub_class: "品牌教练邀请", role_scope_id: "MEMBER",
    item_name: "[C4-INVITE-006] 教练邀请 — 已在服会员再扫新教练码",
    detail_summary: "A教练在服会员扫B教练邀请码",
    expected_observation: "A在服关系不变，新增B教练体验关系",
    priority_id: "P0", prd_ref_id: "PRD_INV_9", source_section: "§9.2",
  }),
  item({
    item_id: "C4-INVITE-007", sub_class: "重复邀请", role_scope_id: "MEMBER",
    item_name: "[C4-INVITE-007] 同一教练再次邀请",
    detail_summary: "已是该教练体验/在服会员再次扫码",
    expected_observation: "不新增关系，提示已在服务关系中",
    priority_id: "P1", prd_ref_id: "PRD_INV_9", source_section: "§9.2",
  }),
  item({
    item_id: "C4-INVITE-008", sub_class: "状态流转", role_scope_id: "MEMBER",
    item_name: "[C4-INVITE-008] 公海会员扫教练邀请",
    detail_summary: "门店公海会员扫品牌教练邀请码",
    expected_observation: "新增教练体验关系，公海身份改为体验（在服则不变）",
    priority_id: "P1", prd_ref_id: "PRD_INV_6", source_section: "§6.4",
  }),
  item({
    item_id: "C4-INVITE-009", sub_class: "多关系并存", role_scope_id: "ALL",
    item_name: "[C4-INVITE-009] 多品牌并存 — A品牌在服+B品牌邀请",
    detail_summary: "会员已在A品牌在服，扫B品牌教练邀请",
    expected_observation: "新增B品牌授权与体验关系，A品牌关系不受影响",
    priority_id: "P0", prd_ref_id: "PRD_INV_9", source_section: "§9",
  }),
  item({
    item_id: "C4-INVITE-010", sub_class: "主档唯一", role_scope_id: "MEMBER",
    item_name: "[C4-INVITE-010] 同手机号不重复建档",
    detail_summary: "同一手机号多次扫码不同邀请",
    expected_observation: "仅一个会员主档，关系按规则追加",
    priority_id: "P0", prd_ref_id: "PRD_INV_3", source_section: "§3",
  }),
  item({
    item_id: "C4-INVITE-011", sub_class: "自由教练预留", role_scope_id: "MEMBER",
    item_name: "[C4-INVITE-011] 自由教练邀请 MVP 拦截",
    detail_summary: "扫描自由教练邀请码（MVP 未开放）",
    expected_observation: "提示暂不支持该邀请类型，不建立关系",
    priority_id: "P1", prd_ref_id: "PRD_INV_7", source_section: "§7.5",
    scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT",
  }),
  item({
    item_id: "C4-INVITE-012", sub_class: "异常场景", role_scope_id: "MEMBER",
    item_name: "[C4-INVITE-012] 邀请码过期或停用",
    detail_summary: "扫描过期/停用/无效邀请码",
    expected_observation: "提示邀请无效，不建立授权关系",
    priority_id: "P0", prd_ref_id: "PRD_INV_12", source_section: "§12",
    scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT",
  }),
  item({
    item_id: "C4-INVITE-013", sub_class: "异常场景", role_scope_id: "MEMBER",
    item_name: "[C4-INVITE-013] 会员拒绝授权",
    detail_summary: "会员在授权页点击拒绝",
    expected_observation: "不建立品牌/门店/教练关系，留痕拒绝记录",
    priority_id: "P0", prd_ref_id: "PRD_INV_12", source_section: "§12",
  }),
  item({
    item_id: "C4-INVITE-014", sub_class: "可见范围", role_scope_id: "COACH",
    item_name: "[C4-INVITE-014] 教练端不可见公海会员",
    detail_summary: "管理端邀请进公海的会员",
    expected_observation: "教练端会员列表不可见，除非被分配或教练邀请",
    priority_id: "P0", prd_ref_id: "PRD_INV_10", source_section: "§10.2",
    scheme_primary_id: "TS-06-PAIR", validation_primary_id: "VS-03-ZERO",
  }),
  item({
    item_id: "C4-INVITE-015", sub_class: "可见范围", role_scope_id: "MANAGER",
    item_name: "[C4-INVITE-015] 管理端可见本店公海/体验/在服",
    detail_summary: "管理端查本店会员",
    expected_observation: "可见公海、体验、在服及历史关系，不可见其他品牌",
    priority_id: "P1", prd_ref_id: "PRD_INV_10", source_section: "§10.1",
  }),
  item({
    item_id: "C4-INVITE-016", sub_class: "可见范围", role_scope_id: "MEMBER",
    item_name: "[C4-INVITE-016] 会员端不展示内部状态标签",
    detail_summary: "会员端查看服务信息",
    expected_observation: "展示授权品牌/门店/教练，不展示公海/体验/在服标签",
    priority_id: "P1", prd_ref_id: "PRD_INV_10", source_section: "§10.4",
  }),
  item({
    item_id: "C4-INVITE-017", sub_class: "留痕", role_scope_id: "ALL",
    item_name: "[C4-INVITE-017] 邀请授权全链路留痕",
    detail_summary: "创建邀请码/扫码/授权/关系建立/状态保持",
    expected_observation: "各动作有创建人、时间、来源、处理结果留痕",
    priority_id: "P0", prd_ref_id: "PRD_INV_14", source_section: "§14",
    is_observability_audit: true,
    scheme_primary_id: "TS-08-OBS", validation_primary_id: "VS-05-PRESENCE",
  }),
  item({
    item_id: "C4-INVITE-018", sub_class: "重复扫码", role_scope_id: "MEMBER",
    item_name: "[C4-INVITE-018] 短时间重复扫码",
    detail_summary: "同一会员短时间多次扫同一邀请码",
    expected_observation: "只处理一次有效关系，其余记为重复扫码",
    priority_id: "P1", prd_ref_id: "PRD_INV_12", source_section: "§12",
  }),

  // ── A3 HTTP/服务（测试金字塔，关联 D 维度已有接口项）──
  {
    item_id: "A3-HTTP-001", dimension_id: "A", category_major_id: "A3", category_minor_id: "A3_HTTP",
    sub_class: "submit", item_name: "[A3-HTTP-001] submit — 202 立即返回",
    detail_summary: "三端 POST /turns/submit 合法请求", expected_observation: "202 + turn_id + poll_url",
    test_input_example: null, preconditions: ["local 全栈可用"],
    test_steps: ["POST submit", "断言 202 载荷字段"], assertion_points: ["202 + turn_id"],
    priority_id: "P0", prd_ref_id: "PRD_2", prd_ref_ids: ["PRD_2"], arch_ref_id: "ARCH_B1",
    arch_ref_ids: ["ARCH_B1"], prd_goal_ids: [], automation_status_id: "AUTO_PARTIAL",
    automation_entry_id: "AUTO_E2E_SMOKE", automation_command: "cd server && npm run test:e2e -- smoke",
    config_env: null, config_env_id: null, station_id: "S02", role_scope_id: "ALL",
    endpoint_path: "/api/chat/turns/submit", http_method: "POST", http_status_expected: 202,
    scheme_primary_id: "TS-01-DET", scheme_secondary_id: null, validation_primary_id: "VS-02-CONTRACT",
    validation_secondary_id: null, sample_execution_note: "HTTP 层单次契约", scheme_mapping_source: "scheme-map.json",
    is_risk_flag: false, is_observability_audit: false, is_p0_blocker: true, failure_symptom: null,
    code_reference: "server/tests/e2e/suites/smoke.suite.ts", tags: ["A3", "D1"],
    notes: "与 D1-SESSION-001 互补，侧重测试金字塔 A 层", source_doc: "A-测试层级.md", source_section: "A3",
    is_active: true, exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_ANY",
    project_code: "fitness-agent", project_name: "Fitness Agent 测试项目",
  },
  {
    item_id: "A3-HTTP-002", dimension_id: "A", category_major_id: "A3", category_minor_id: "A3_HTTP",
    sub_class: "stream", item_name: "[A3-HTTP-002] stream — SSE 事件序列",
    detail_summary: "GET stream 连接合法 turn", expected_observation: "status/thinking/message/done 事件序列",
    preconditions: ["local 全栈可用"], test_steps: ["submit 后连接 stream", "断言 SSE 帧类型"],
    assertion_points: ["SSE 事件序列合法"], priority_id: "P0", prd_ref_ids: ["PRD_2"],
    arch_ref_ids: ["ARCH_B6"], prd_goal_ids: [], automation_status_id: "AUTO_PARTIAL",
    automation_entry_id: "AUTO_E2E_SMOKE", automation_command: "cd server && npm run test:e2e -- smoke",
    station_id: "S06", role_scope_id: "ALL", endpoint_path: "/api/chat/turns/:id/stream",
    http_method: "GET", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT",
    sample_execution_note: "HTTP 层 SSE 契约", scheme_mapping_source: "scheme-map.json",
    is_p0_blocker: true, code_reference: "server/tests/e2e/suites/smoke.suite.ts",
    tags: ["A3", "D5"], source_doc: "A-测试层级.md", source_section: "A3", is_active: true,
    exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_ANY", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", detail_summary: "GET stream 连接合法 turn",
    item_name: "[A3-HTTP-002] stream — SSE 事件序列", category_major_id: "A3", category_minor_id: "A3_HTTP",
    test_input_example: null, prd_ref_id: null, arch_ref_id: null, config_env: null, config_env_id: null,
    http_status_expected: null, scheme_secondary_id: null, validation_secondary_id: null,
    is_risk_flag: false, is_observability_audit: false, failure_symptom: null, notes: null,
    automation_command: "cd server && npm run test:e2e -- smoke", automation_entry_id: "AUTO_E2E_SMOKE",
    automation_status_id: "AUTO_PARTIAL", expected_observation: "status/thinking/message/done 事件序列",
  },
  {
    item_id: "A3-HTTP-003", dimension_id: "A", category_major_id: "A3", category_minor_id: "A3_HTTP",
    sub_class: "探针", item_name: "[A3-HTTP-003] health — 就绪探针",
    detail_summary: "GET /health 或 /ready", expected_observation: "200 + 服务就绪",
    preconditions: ["服务已启动"], test_steps: ["GET health", "断言 200"],
    assertion_points: ["200 就绪"], priority_id: "P1", prd_ref_ids: [], arch_ref_ids: [],
    prd_goal_ids: [], automation_status_id: "AUTO_TODO", automation_entry_id: "AUTO_TODO_SCRIPT",
    station_id: "NONE", role_scope_id: "SYSTEM", endpoint_path: "/health", http_method: "GET",
    http_status_expected: 200, scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT",
    sample_execution_note: "运维探针", scheme_mapping_source: "scheme-map.json",
    tags: ["A3"], source_doc: "A-测试层级.md", source_section: "A3", is_active: true,
    exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_ANY", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", detail_summary: "GET /health 或 /ready",
    test_input_example: null, prd_ref_id: null, arch_ref_id: null, config_env: null, config_env_id: null,
    scheme_secondary_id: null, validation_secondary_id: null, is_risk_flag: false,
    is_observability_audit: false, is_p0_blocker: false, failure_symptom: null, code_reference: null, notes: null,
    automation_command: null,
  },
  {
    item_id: "A3-HTTP-004", dimension_id: "A", category_major_id: "A3", category_minor_id: "A3_HTTP",
    sub_class: "cancel", item_name: "[A3-HTTP-004] cancel — 取消在途 turn",
    detail_summary: "POST cancel 合法 turn_id", expected_observation: "取消成功，Pi 不再 persist",
    preconditions: ["存在 pending/processing turn"], test_steps: ["submit 后立即 cancel", "断言 cancelled"],
    assertion_points: ["turn 状态 cancelled"], priority_id: "P0", prd_ref_ids: ["PRD_2"],
    arch_ref_ids: ["ARCH_B3"], prd_goal_ids: [], automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03", automation_command: "cd server && npm run test:stations -- s03",
    station_id: "S03", role_scope_id: "ALL", http_method: "POST", http_status_expected: 200,
    scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT",
    sample_execution_note: "HTTP cancel 契约", scheme_mapping_source: "scheme-map.json",
    is_p0_blocker: true, code_reference: "server/src/stations/s03-queue/tests/turn-job-lifecycle.test.ts",
    tags: ["A3", "D1"], source_doc: "A-测试层级.md", source_section: "A3", is_active: true,
    exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_ANY", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", detail_summary: "POST cancel 合法 turn_id",
    item_name: "[A3-HTTP-004] cancel — 取消在途 turn", test_input_example: null,
    prd_ref_id: null, arch_ref_id: null, endpoint_path: null, config_env: null, config_env_id: null,
    scheme_secondary_id: null, validation_secondary_id: null, is_risk_flag: false,
    is_observability_audit: false, failure_symptom: null, notes: null,
    expected_observation: "取消成功，Pi 不再 persist",
  },
  {
    item_id: "A3-HTTP-005", dimension_id: "A", category_major_id: "A3", category_minor_id: "A3_HTTP",
    sub_class: "poll", item_name: "[A3-HTTP-005] poll — SSE 不可用兜底",
    detail_summary: "GET poll 查询 turn 状态", expected_observation: "返回 status + 最终 message",
    preconditions: ["turn 已 submit"], test_steps: ["SSE 断开后 poll", "断言终态"],
    assertion_points: ["poll 返回终态"], priority_id: "P1", prd_ref_ids: ["PRD_2"],
    arch_ref_ids: ["ARCH_B6"], prd_goal_ids: [], automation_status_id: "AUTO_TODO",
    automation_entry_id: "AUTO_TODO_SCRIPT", station_id: "S06", role_scope_id: "ALL",
    http_method: "GET", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT",
    sample_execution_note: "poll 兜底路径", scheme_mapping_source: "scheme-map.json",
    tags: ["A3", "D1"], source_doc: "A-测试层级.md", source_section: "A3", is_active: true,
    exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_ANY", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", detail_summary: "GET poll 查询 turn 状态",
    test_input_example: null, prd_ref_id: null, arch_ref_id: null, endpoint_path: null,
    config_env: null, config_env_id: null, http_status_expected: null,
    scheme_secondary_id: null, validation_secondary_id: null, is_risk_flag: false,
    is_observability_audit: false, is_p0_blocker: false, failure_symptom: null, code_reference: null,
    notes: null, automation_command: null,
    item_name: "[A3-HTTP-005] poll — SSE 不可用兜底",
    expected_observation: "返回 status + 最终 message",
  },

  // ── A4 全栈 E2E（关联已有 e2e suite）──
  {
    item_id: "A4-E2E-001", dimension_id: "A", category_major_id: "A4", category_minor_id: "A4_E2E",
    sub_class: "smoke", item_name: "[A4-E2E-001] smoke — 三端各一条主链",
    detail_summary: "coach/member/manager 各 submit+stream 一条", expected_observation: "三端均收到 text 回复",
    preconditions: ["local 全栈 + LLM mock 可用"], test_steps: ["运行 smoke e2e"],
    assertion_points: ["三端 smoke pass"], priority_id: "P0", prd_ref_ids: ["PRD_2"],
    arch_ref_ids: ["ARCH_S1"], prd_goal_ids: [], automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_E2E_SMOKE", automation_command: "cd server && npm run test:e2e -- smoke",
    station_id: "NONE", role_scope_id: "ALL", scheme_primary_id: "TS-05-CHAIN",
    validation_primary_id: "VS-04-CHAIN-OK", sample_execution_note: "全栈 smoke",
    scheme_mapping_source: "scheme-map.json", is_p0_blocker: true,
    code_reference: "server/tests/e2e/suites/smoke.suite.ts", tags: ["A4", "E2E"],
    source_doc: "A-测试层级.md", source_section: "A4", is_active: true,
    exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_STAGING", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", test_input_example: null, prd_ref_id: null,
    arch_ref_id: null, config_env: null, config_env_id: null, endpoint_path: null,
    http_method: null, http_status_expected: null, scheme_secondary_id: null,
    validation_secondary_id: null, is_risk_flag: false, is_observability_audit: false,
    failure_symptom: null, notes: null,
  },
  {
    item_id: "A4-E2E-002", dimension_id: "A", category_major_id: "A4", category_minor_id: "A4_E2E",
    sub_class: "chain", item_name: "[A4-E2E-002] chain — 训练计划 CRUD 主链",
    detail_summary: "plan_form → 草稿 → 提交 → 会员确认", expected_observation: "计划状态机全链通过",
    preconditions: ["教练+会员种子"], test_steps: ["运行 chain e2e"],
    assertion_points: ["macro plan 状态流转正确"], priority_id: "P0", prd_ref_ids: ["PRD_4_4"],
    arch_ref_ids: ["ARCH_B4"], prd_goal_ids: [], automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_E2E_CHAIN", automation_command: "cd server && npm run test:e2e -- chain",
    station_id: "NONE", role_scope_id: "COACH", scheme_primary_id: "TS-05-CHAIN",
    validation_primary_id: "VS-04-CHAIN-OK", is_p0_blocker: true,
    code_reference: "server/tests/e2e/suites/chain.suite.ts", tags: ["A4", "C1"],
    source_doc: "A-测试层级.md", source_section: "A4", is_active: true,
    exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_STAGING", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", detail_summary: "plan_form → 草稿 → 提交 → 会员确认",
    test_input_example: null, prd_ref_id: "PRD_4_4", arch_ref_id: null, config_env: null,
    config_env_id: null, endpoint_path: null, http_method: null, http_status_expected: null,
    scheme_secondary_id: null, validation_secondary_id: null, sample_execution_note: "全栈 chain",
    scheme_mapping_source: "scheme-map.json", is_risk_flag: false, is_observability_audit: false,
    failure_symptom: null, notes: null,
  },
  {
    item_id: "A4-E2E-003", dimension_id: "A", category_major_id: "A4", category_minor_id: "A4_E2E",
    sub_class: "session", item_name: "[A4-E2E-003] session — 课时全链",
    detail_summary: "require_form → session_plan → 确认 → 完成", expected_observation: "课时状态机全链通过",
    preconditions: ["已有 active 计划"], test_steps: ["运行 session e2e"],
    assertion_points: ["session 状态流转正确"], priority_id: "P0", prd_ref_ids: ["PRD_4_5"],
    automation_status_id: "AUTO_EXISTING", automation_entry_id: "AUTO_E2E_SESSION",
    automation_command: "cd server && npm run test:e2e -- session",
    code_reference: "server/tests/e2e/suites/session.suite.ts", tags: ["A4", "C1"],
    source_doc: "A-测试层级.md", source_section: "A4", is_active: true,
    station_id: "NONE", role_scope_id: "COACH", scheme_primary_id: "TS-05-CHAIN",
    validation_primary_id: "VS-04-CHAIN-OK", is_p0_blocker: true,
    exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_STAGING", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", arch_ref_ids: [], prd_goal_ids: [],
    test_input_example: null, prd_ref_id: "PRD_4_5", arch_ref_id: null, config_env: null,
    config_env_id: null, endpoint_path: null, http_method: null, http_status_expected: null,
    scheme_secondary_id: null, validation_secondary_id: null, sample_execution_note: "全栈 session",
    scheme_mapping_source: "scheme-map.json", is_risk_flag: false, is_observability_audit: false,
    failure_symptom: null, notes: null, detail_summary: "require_form → session_plan → 确认 → 完成",
    item_name: "[A4-E2E-003] session — 课时全链",
    expected_observation: "课时状态机全链通过",
  },

  // ── B_REL 可靠性法则 ──
  {
    item_id: "B_REL-IDEM-001", dimension_id: "B", category_major_id: "B_REL", category_minor_id: "B_REL_IDEM",
    sub_class: "幂等", item_name: "[B_REL-IDEM-001] client_turn_id 幂等",
    detail_summary: "相同 client_turn_id 重试 submit", expected_observation: "返回首次结果，不重复 Pi/写库",
    preconditions: ["local 可用"], test_steps: ["同 id 两次 submit"],
    assertion_points: ["仅一次 Pi 执行"], priority_id: "P0", prd_ref_ids: ["PRD_4_11"],
    arch_ref_ids: ["ARCH_S11", "ARCH_B2"], automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02", automation_command: "cd server && npm run test:stations -- s02",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    station_id: "S02", role_scope_id: "ALL", scheme_primary_id: "TS-01-DET",
    validation_primary_id: "VS-01-EXACT", is_p0_blocker: true, tags: ["B_REL", "B2", "B3"],
    source_doc: "B-六站流水线.md", source_section: "B_REL", is_active: true,
    exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_ANY", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", prd_goal_ids: [], test_input_example: null,
    prd_ref_id: "PRD_4_11", arch_ref_id: null, config_env: null, config_env_id: null,
    endpoint_path: null, http_method: null, http_status_expected: null,
    scheme_secondary_id: null, validation_secondary_id: null, sample_execution_note: "可靠性法则",
    scheme_mapping_source: "scheme-map.json", is_risk_flag: false, is_observability_audit: false,
    failure_symptom: null, notes: null,
  },
  {
    item_id: "B_REL-SER-001", dimension_id: "B", category_major_id: "B_REL", category_minor_id: "B_REL_SER",
    sub_class: "串行", item_name: "[B_REL-SER-001] 同 session 串行",
    detail_summary: "同 session 在途时第二条 submit", expected_observation: "429 + retry_after_sec",
    priority_id: "P0", arch_ref_ids: ["ARCH_B2"], automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02", automation_command: "cd server && npm run test:stations -- s02",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    station_id: "S02", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT",
    is_p0_blocker: true, tags: ["B_REL", "B2"], source_doc: "B-六站流水线.md", source_section: "B_REL",
    is_active: true, exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_ANY", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", preconditions: ["local 可用"],
    test_steps: ["pending 在途时第二条 submit"], assertion_points: ["429"],
    prd_ref_ids: ["PRD_2"], prd_goal_ids: [], role_scope_id: "ALL",
    detail_summary: "同 session 在途时第二条 submit", expected_observation: "429 + retry_after_sec",
    test_input_example: null, prd_ref_id: null, arch_ref_id: null, config_env: null, config_env_id: null,
    endpoint_path: null, http_method: null, http_status_expected: 429,
    scheme_secondary_id: null, validation_secondary_id: null, sample_execution_note: "可靠性法则",
    scheme_mapping_source: "scheme-map.json", is_risk_flag: false, is_observability_audit: false,
    failure_symptom: null, notes: null,
  },
  {
    item_id: "B_REL-CAN-001", dimension_id: "B", category_major_id: "B_REL", category_minor_id: "B_REL_CAN",
    sub_class: "可取消", item_name: "[B_REL-CAN-001] turn 可取消",
    detail_summary: "pending/processing turn cancel", expected_observation: "状态 cancelled，不再 persist",
    priority_id: "P0", arch_ref_ids: ["ARCH_B3"], automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03", automation_command: "cd server && npm run test:stations -- s03",
    code_reference: "server/src/stations/s03-queue/tests/turn-job-lifecycle.test.ts",
    station_id: "S03", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT",
    is_p0_blocker: true, tags: ["B_REL", "B3"], source_doc: "B-六站流水线.md", source_section: "B_REL",
    is_active: true, exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_ANY", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", preconditions: ["local 可用"],
    test_steps: ["submit 后 cancel"], assertion_points: ["cancelled"],
    prd_ref_ids: [], prd_goal_ids: [], role_scope_id: "ALL",
    detail_summary: "pending/processing turn cancel", expected_observation: "状态 cancelled，不再 persist",
    test_input_example: null, prd_ref_id: null, arch_ref_id: null, config_env: null, config_env_id: null,
    endpoint_path: null, http_method: null, http_status_expected: null,
    scheme_secondary_id: null, validation_secondary_id: null, sample_execution_note: "可靠性法则",
    scheme_mapping_source: "scheme-map.json", is_risk_flag: false, is_observability_audit: false,
    failure_symptom: null, notes: null,
  },
  {
    item_id: "B_REL-REC-001", dimension_id: "B", category_major_id: "B_REL", category_minor_id: "B_REL_REC",
    sub_class: "可恢复", item_name: "[B_REL-REC-001] SSE 断线续传",
    detail_summary: "stream 中断后 resumeStream", expected_observation: "从断点继续，不重复写库",
    priority_id: "P1", automation_status_id: "AUTO_EXISTING", automation_entry_id: "AUTO_E2E_RESUME",
    automation_command: "cd server && npm run test:e2e -- resume",
    code_reference: "server/tests/e2e/suites/resume.suite.ts",
    station_id: "S06", scheme_primary_id: "TS-05-CHAIN", validation_primary_id: "VS-04-CHAIN-OK",
    tags: ["B_REL", "B6", "G4"], source_doc: "B-六站流水线.md", source_section: "B_REL",
    is_active: true, exec_env_id: "EXEC_BOTH", env_tier_id: "TIER_ANY", project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目", preconditions: ["local 可用"],
    test_steps: ["中断 SSE 后 resume"], assertion_points: ["续传成功"],
    prd_ref_ids: [], arch_ref_ids: ["ARCH_B6"], prd_goal_ids: [], role_scope_id: "ALL",
    is_p0_blocker: false, detail_summary: "stream 中断后 resumeStream",
    expected_observation: "从断点继续，不重复写库", test_input_example: null,
    prd_ref_id: null, arch_ref_id: null, config_env: null, config_env_id: null,
    endpoint_path: null, http_method: null, http_status_expected: null,
    scheme_secondary_id: null, validation_secondary_id: null, sample_execution_note: "可靠性法则",
    scheme_mapping_source: "scheme-map.json", is_risk_flag: false, is_observability_audit: false,
    failure_symptom: null, notes: null,
  },
];

const NEW_PRD_REFS = [
  { prd_ref_id: "PRD_INV_3", section: "§3", title: "邀请核心设计结论", project_code: "fitness-agent" },
  { prd_ref_id: "PRD_INV_5", section: "§5", title: "管理端邀请规则", project_code: "fitness-agent" },
  { prd_ref_id: "PRD_INV_6", section: "§6", title: "品牌教练邀请规则", project_code: "fitness-agent" },
  { prd_ref_id: "PRD_INV_7", section: "§7", title: "自由教练邀请预留", project_code: "fitness-agent" },
  { prd_ref_id: "PRD_INV_9", section: "§9", title: "多关系并存规则", project_code: "fitness-agent" },
  { prd_ref_id: "PRD_INV_10", section: "§10", title: "权限与可见范围", project_code: "fitness-agent" },
  { prd_ref_id: "PRD_INV_12", section: "§12", title: "邀请异常场景", project_code: "fitness-agent" },
  { prd_ref_id: "PRD_INV_14", section: "§14", title: "邀请留痕规则", project_code: "fitness-agent" },
  { prd_ref_id: "PRD_INV_15", section: "§15", title: "邀请验收标准", project_code: "fitness-agent" },
];

const NEW_MINORS = [
  { category_minor_id: "C4_INVITE", category_major_id: "C4", name: "会员邀请与授权", sort_order: 10, category_major_name: "横切业务与状态机", project_code: "fitness-agent" },
  { category_minor_id: "B_REL_IDEM", category_major_id: "B_REL", name: "幂等法则", sort_order: 1, category_major_name: "可靠性法则", project_code: "fitness-agent" },
  { category_minor_id: "B_REL_SER", category_major_id: "B_REL", name: "串行法则", sort_order: 2, category_major_name: "可靠性法则", project_code: "fitness-agent" },
  { category_minor_id: "B_REL_CAN", category_major_id: "B_REL", name: "可取消", sort_order: 3, category_major_name: "可靠性法则", project_code: "fitness-agent" },
  { category_minor_id: "B_REL_REC", category_major_id: "B_REL", name: "可恢复", sort_order: 4, category_major_name: "可靠性法则", project_code: "fitness-agent" },
];

// ── merge data.json ──
const rows = JSON.parse(readFileSync(dataFile, "utf8"));
const existingIds = new Set(rows.map((r) => r.item_id));
let added = 0;
for (const ni of NEW_ITEMS) {
  if (existingIds.has(ni.item_id)) {
    console.log(`SKIP exists: ${ni.item_id}`);
    continue;
  }
  rows.push(ni);
  added++;
}
writeFileSync(dataFile, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`Added ${added} items → total ${rows.length}`);

// ── regenerate init.sql INSERT section ──
const ddlEnd = readFileSync(initSqlFile, "utf8").split("\n-- 数据导入")[0];
const insertLines = rows.filter((r) => r.is_active !== false).map((r) => {
  const filtered = {};
  for (const col of INSERT_COLUMNS) filtered[col] = r[col] ?? null;
  return buildInsertLine(filtered);
});
writeFileSync(
  initSqlFile,
  `${ddlEnd}\n-- 数据导入（${rows.length} 条）\n${insertLines.join("\n")}\n`,
  "utf8",
);
console.log(`Regenerated init.sql with ${insertLines.length} INSERT lines`);

// ── update category_major counts ──
const majors = JSON.parse(readFileSync(majorFile, "utf8"));
const countByMajor = {};
for (const r of rows.filter((x) => x.is_active !== false)) {
  countByMajor[r.category_major_id] = (countByMajor[r.category_major_id] || 0) + 1;
}
for (const m of majors) {
  if (countByMajor[m.category_major_id] !== undefined) {
    m.item_count = countByMajor[m.category_major_id];
  }
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
console.log("Updated test_category_major counts:", countByMajor);

// ── add minors ──
const minors = JSON.parse(readFileSync(minorFile, "utf8"));
const minorIds = new Set(minors.map((m) => m.category_minor_id));
for (const nm of NEW_MINORS) {
  if (!minorIds.has(nm.category_minor_id)) {
    minors.push(nm);
    const line = `INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('${nm.category_minor_id}', '${nm.category_major_id}', '${nm.name}', ${nm.sort_order}) ON CONFLICT (category_minor_id) DO NOTHING;`;
    if (!readFileSync(minorInitFile, "utf8").includes(nm.category_minor_id)) {
      writeFileSync(minorInitFile, `${readFileSync(minorInitFile, "utf8").trim()}\n${line}\n`, "utf8");
    }
  }
}
writeFileSync(minorFile, `${JSON.stringify(minors, null, 2)}\n`, "utf8");
console.log("Added minors:", NEW_MINORS.map((m) => m.category_minor_id).join(", "));

// ── add prd_reference ──
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
console.log("Added prd_reference:", NEW_PRD_REFS.map((p) => p.prd_ref_id).join(", "));

console.log("\n下一步：cd deploy && ams-testgen db:reset test_item_detail test_category_major test_category_minor prd_reference");
