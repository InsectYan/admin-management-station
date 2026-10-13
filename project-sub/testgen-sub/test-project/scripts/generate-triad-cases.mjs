#!/usr/bin/env node
/**
 * 三端用例重建：清空 test_item_detail 种子，按三个项目注入 FE / BE / AG 用例，
 * 并写出 triad-cases.md + import-triad-cases.mjs。
 *
 * Usage:
 *   node test-project/scripts/generate-triad-cases.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const testgenRoot = join(here, "../..");
const docsRoot = join(here, "../../../../../../fitness/fitness-agent-test-docs");
const docsRootAlt = join(here, "../../../../../../fitness-agent-test-docs");
const fitnessDocs = (() => {
  try {
    readFileSync(join(docsRoot, "测试用例分类体系.md"), "utf8");
    return docsRoot;
  } catch {
    try {
      readFileSync(join(docsRootAlt, "测试用例分类体系.md"), "utf8");
      return docsRootAlt;
    } catch {
      return null;
    }
  }
})();

const PROJECTS = [
  {
    project_code: "lejian-wx-miniapp",
    project_name: "启炼前端 · 微信小程序",
    team: "QA 团队",
    status: "active",
    description: "lejian-wx-miniapp：教练/会员/店长前端呈现、交互、流式卡片与权限门禁。",
    repo_urls: ["lejian-wx-miniapp"],
    cicd_config: { provider: "manual", pipeline: "" },
    member_roles: [{ user: "admin", role: "owner" }],
  },
  {
    project_code: "lejian-business-service",
    project_name: "启炼服务端 · 业务 API",
    team: "QA 团队",
    status: "active",
    description: "lejian-business-service：/miniapp/* 与 /agent/* 接口、状态机、鉴权与 Agent 读数。",
    repo_urls: ["lejian-business-service"],
    cicd_config: { provider: "manual", pipeline: "" },
    member_roles: [{ user: "admin", role: "owner" }],
  },
  {
    project_code: "fitness-agent",
    project_name: "启炼 Agent · Pi",
    team: "QA 团队",
    status: "active",
    description: "fitness-agent/.pi：场景围栏、emit 契约、教练工作流、会员/店长边界与 HTTP。",
    repo_urls: ["fitness-agent"],
    cicd_config: { provider: "manual", pipeline: "npm test" },
    member_roles: [{ user: "admin", role: "owner" }],
  },
];

const INSERT_COLUMNS = [
  "project_code", "project_name",
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
  if (Array.isArray(v) || typeof v === "object") {
    // db-cli 按分号切语句：JSON 文本内不得含裸 ;
    const raw = JSON.stringify(v).replace(/;/g, " / ").replace(/'/g, "''");
    return `'${raw}'::jsonb`;
  }
  // db-cli 按分号切语句：字符串字段内不得含 ;
  return `'${String(v).replace(/;/g, " / ").replace(/'/g, "''")}'`;
}

function buildInsert(row) {
  const vals = INSERT_COLUMNS.map((c) => sqlVal(row[c] ?? null));
  return `INSERT INTO test_item_detail (${INSERT_COLUMNS.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT (item_id) DO NOTHING;`;
}

function baseRow(p) {
  const pri = p.priority_id || "P1";
  const major = p.category_major_id || "T10";
  const dim = { T1: "S", T2: "S", T7: "S", T3: "B", T4: "B", T5: "B", T6: "Q", T10: "Q", T12: "Q", T8: "R", T9: "R", T11: "R" }[major] || "S";
  return {
    dimension_id: p.dimension_id || dim,
    category_major_id: major,
    category_minor_id: p.category_minor_id || "T10_UI",
    sub_class: p.sub_class || "GENERAL",
    item_name: p.item_name || `[${p.item_id}] ${p.detail_summary}`.slice(0, 120),
    detail_summary: p.detail_summary,
    expected_observation: p.expected_observation,
    test_input_example: p.test_input_example || null,
    preconditions: p.preconditions || ["环境可访问", "已登录对应角色"],
    test_steps: p.test_steps || ["按前置准备", "执行操作", `断言：${p.expected_observation}`],
    assertion_points: p.assertion_points || [p.expected_observation],
    priority_id: pri,
    prd_ref_id: null,
    prd_ref_ids: [],
    arch_ref_id: null,
    arch_ref_ids: [],
    prd_goal_ids: [],
    automation_status_id: p.automation_status_id || "AUTO_TODO",
    automation_entry_id: p.automation_entry_id || "AUTO_TODO_SCRIPT",
    automation_command: p.automation_command || null,
    config_env: null,
    config_env_id: null,
    station_id: "NONE",
    role_scope_id: p.role_scope_id || "COACH",
    endpoint_path: p.endpoint_path || null,
    http_method: p.http_method || null,
    http_status_expected: p.http_status_expected ?? null,
    template_code: null,
    scheme_primary_id: p.scheme_primary_id || "TS-01-DET",
    scheme_secondary_id: null,
    validation_primary_id: p.validation_primary_id || "VS-01-EXACT",
    validation_secondary_id: null,
    sample_execution_note: p.sample_execution_note || null,
    scheme_mapping_source: p.scheme_mapping_source || "三端用例目录.md",
    is_risk_flag: !!p.is_risk_flag,
    is_observability_audit: !!p.is_observability_audit,
    is_p0_blocker: p.is_p0_blocker ?? pri === "P0",
    failure_symptom: null,
    code_reference: p.code_reference || null,
    tags: p.tags || [],
    notes: p.notes || null,
    source_doc: p.source_doc || "三端用例目录.md",
    source_section: p.source_section || "GEN",
    is_active: true,
    exec_env_id: "EXEC_BOTH",
    env_tier_id: "TIER_ANY",
    project_code: p.project_code,
    project_name: p.project_name,
    item_id: p.item_id,
  };
}

/** 前端 · lejian-wx-miniapp */
function buildFeCases() {
  const pc = "lejian-wx-miniapp";
  const pn = "启炼前端 · 微信小程序";
  const mk = (p) =>
    baseRow({
      project_code: pc,
      project_name: pn,
      category_major_id: "T10",
      category_minor_id: p.category_minor_id || (p.sub_class === "UI-TEXT" ? "T10_COPY" : "T10_UI"),
      scheme_primary_id: "TS-01-DET",
      validation_primary_id: "VS-01-EXACT",
      tags: ["FE", "T10", ...(p.tags || [])],
      notes: p.notes || "真源：lejian-wx-miniapp + 前端UI；分类规则见 fitness-agent-test-docs T1–T12 / T10",
      ...p,
    });

  return [
    mk({ item_id: "FE-LOGIN-001", priority_id: "P0", sub_class: "UI-INTERACT", role_scope_id: "ALL", detail_summary: "登录页可完成身份选择并进入对应端", expected_observation: "选择教练/会员/店长后进入对应分包首页", code_reference: "pages/login; pages/select-identity", source_section: "登录", test_steps: ["打开登录页", "完成授权/登录", "选择身份", "进入对应首页"], assertion_points: ["身份选择生效", "跳转分包正确"] }),
    mk({ item_id: "FE-LOGIN-002", priority_id: "P1", sub_class: "UI-TEXT", category_minor_id: "T10_COPY", role_scope_id: "ALL", detail_summary: "账号未开通/邀请错误页文案可读", expected_observation: "未开通与邀请错误页有明确提示与返回入口", code_reference: "pages/account-unopened; pages/invite-error", source_section: "登录" }),
    mk({ item_id: "FE-NAV-001", priority_id: "P0", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "教练端主导航可切换工作台与会员相关入口", expected_observation: "导航切换无白屏；当前态高亮正确", code_reference: "subpackages/coach/pages/home", source_section: "导航", category_major_id: "T2", category_minor_id: "T2_ROLE", dimension_id: "S", tags: ["FE", "T2"] }),
    mk({ item_id: "FE-HOME-001", priority_id: "P0", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "教练工作台可发起 AI 对话 turn", expected_observation: "输入发送后进入思考/流式；仅 chat-session 发起 turn", code_reference: "components/chat/chat-session; subpackages/coach/pages/home/home.js", source_section: "聊天", category_major_id: "T7", category_minor_id: "T7_STREAM", dimension_id: "S", scheme_primary_id: "TS-05-CHAIN", validation_primary_id: "VS-04-CHAIN-OK", tags: ["FE", "T7", "STREAM"] }),
    mk({ item_id: "FE-HOME-002", priority_id: "P0", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "流式过程展示思考中态与最终气泡", expected_observation: "思考中可见；结束后合并为最终消息，不残留半截乱入", code_reference: "service/chat/agent-stream.js; utils/chat/message-model.js", source_section: "聊天", category_major_id: "T7", category_minor_id: "T7_STREAM", dimension_id: "S", tags: ["FE", "T7", "STREAM"] }),
    mk({ item_id: "FE-CARD-001", priority_id: "P0", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "plan_form 卡片可填写并提交", expected_observation: "卡片按 message_type 渲染；提交触发 PLAN_FORM_SUBMIT 链路", code_reference: "utils/chat/message-registry.js; utils/plan-form.js", source_section: "卡片", category_major_id: "T3", category_minor_id: "T3_FLOW", dimension_id: "B", scheme_primary_id: "TS-05-CHAIN", validation_primary_id: "VS-04-CHAIN-OK", tags: ["FE", "T3"] }),
    mk({ item_id: "FE-CARD-002", priority_id: "P0", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "require_form / session_plan 卡片可打开课时详情", expected_observation: "点击查看打开 lesson-detail-sheet；草稿/生效态可区分", code_reference: "subpackages/coach/components/lesson-detail-sheet", source_section: "卡片", category_major_id: "T3", category_minor_id: "T3_FLOW", dimension_id: "B", tags: ["FE", "T3"] }),
    mk({ item_id: "FE-CARD-003", priority_id: "P0", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "训练总结确认卡与五态一致", expected_observation: "总结卡可确认；失败可手动输入/重生成；不因额外落库阻塞确认", code_reference: "subpackages/coach/pages/home/home.js; course-detail", source_section: "总结", category_major_id: "T3", category_minor_id: "T3_CONFIRM", dimension_id: "B", tags: ["FE", "T3"] }),
    mk({ item_id: "FE-CARD-004", priority_id: "P1", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "member_switch / disambiguation 卡片可选人", expected_observation: "候选列表可选；确认后绑定当前会员上下文", code_reference: "utils/chat/message-registry.js", source_section: "卡片", category_major_id: "T3", category_minor_id: "T3_FLOW", dimension_id: "B", tags: ["FE", "T3"] }),
    mk({ item_id: "FE-MEM-001", priority_id: "P0", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "会员详情页 Tab 与目标总览可读", expected_observation: "档案 Tab 可切换；目标总览优先读 training_plan.goal_overview", code_reference: "subpackages/coach/pages/member-detail", source_section: "会员详情", tags: ["FE", "T10"] }),
    mk({ item_id: "FE-MEM-002", priority_id: "P1", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "会员绑定/邀请入口可用", expected_observation: "bind / invite-member 可打开并完成邀请或选人", code_reference: "subpackages/coach/pages/bind; invite-member", source_section: "会员操作", tags: ["FE", "T10"] }),
    mk({ item_id: "FE-ASSESS-001", priority_id: "P1", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "五项评估录入页可进入并保存", expected_observation: "体成分/体态/围度/关节/体能页可录入并提交", code_reference: "subpackages/coach/pages/body-composition 等", source_section: "评估", category_major_id: "T3", category_minor_id: "T3_FLOW", dimension_id: "B", tags: ["FE", "T3"] }),
    mk({ item_id: "FE-ASSESS-002", priority_id: "P1", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "健康问卷页可填写提交", expected_observation: "问卷可答并提交；结果可回会员档案", code_reference: "subpackages/coach/pages/health-questionnaire", source_section: "评估", tags: ["FE", "T10"] }),
    mk({ item_id: "FE-COURSE-001", priority_id: "P0", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "课时详情页五态展示与编辑", expected_observation: "draft/active/completed 等状态文案与可编辑区符合五态", code_reference: "subpackages/coach/pages/course-detail", source_section: "课时", category_major_id: "T3", category_minor_id: "T3_STATE", dimension_id: "B", tags: ["FE", "T3"] }),
    mk({ item_id: "FE-ERR-001", priority_id: "P0", sub_class: "UI-TEXT", category_minor_id: "T10_COPY", role_scope_id: "ALL", detail_summary: "超时/504 用户文案可读", expected_observation: "error-message 给出人话提示，非裸技术栈信息", code_reference: "utils/chat/error-message.js", source_section: "异常", is_risk_flag: true, tags: ["FE", "T10"] }),
    mk({ item_id: "FE-PERM-001", priority_id: "P0", sub_class: "UI-INTERACT", role_scope_id: "MEMBER", detail_summary: "会员端不可见教练写库类入口", expected_observation: "会员首页无生成计划/写课时主 CTA；仅咨询与自助页", code_reference: "subpackages/member/pages/home", source_section: "权限", category_major_id: "T2", category_minor_id: "T2_CAPABILITY", dimension_id: "S", scheme_primary_id: "TS-02-BND", validation_primary_id: "VS-03-ZERO", is_risk_flag: true, tags: ["FE", "T2"] }),
    mk({ item_id: "FE-MBR-HOME-001", priority_id: "P1", sub_class: "UI-INTERACT", role_scope_id: "MEMBER", detail_summary: "会员 AI 咨询可 turn", expected_observation: "member_consult 场景可对话；卡片仅为 text 友好呈现", code_reference: "subpackages/member/pages/home", source_section: "会员", category_major_id: "T7", category_minor_id: "T7_STREAM", dimension_id: "S", tags: ["FE", "T7"] }),
    mk({ item_id: "FE-MBR-PLAN-001", priority_id: "P1", sub_class: "UI-INTERACT", role_scope_id: "MEMBER", detail_summary: "会员运动记录/计划详情可读目标总览", expected_observation: "sport-record / plan-detail 展示 goal_overview 或空态", code_reference: "subpackages/member/pages/sport-record; plan-detail", source_section: "会员", tags: ["FE", "T10"] }),
    mk({ item_id: "FE-ADM-001", priority_id: "P1", sub_class: "UI-INTERACT", role_scope_id: "MANAGER", detail_summary: "店长看板可发起运营咨询", expected_observation: "dashboard scene=manager_ops 可对话；无教练写计划卡片", code_reference: "subpackages/admin/pages/dashboard", source_section: "店长", category_major_id: "T2", category_minor_id: "T2_CAPABILITY", dimension_id: "S", tags: ["FE", "T2"] }),
    mk({ item_id: "FE-SET-001", priority_id: "P2", sub_class: "UI-INTERACT", role_scope_id: "COACH", detail_summary: "教练人设/设置页可编辑", expected_observation: "career / settings 可打开保存", code_reference: "subpackages/coach/pages/career; settings", source_section: "设置", tags: ["FE", "T10"] }),
  ];
}

/** 服务端 · lejian-business-service */
function buildBeCases() {
  const pc = "lejian-business-service";
  const pn = "启炼服务端 · 业务 API";
  const mk = (p) =>
    baseRow({
      project_code: pc,
      project_name: pn,
      category_major_id: p.category_major_id || "T7",
      category_minor_id: p.category_minor_id || "T7_HTTP",
      dimension_id: p.dimension_id || "S",
      scheme_primary_id: p.scheme_primary_id || "TS-01-DET",
      validation_primary_id: p.validation_primary_id || "VS-01-EXACT",
      tags: ["BE", p.category_major_id || "T7", ...(p.tags || [])],
      notes: p.notes || "真源：lejian-business-service/router；分类规则 T1–T12",
      preconditions: p.preconditions || ["业务服务可访问", "持有合法 token / Internal Key"],
      ...p,
    });

  return [
    mk({ item_id: "BE-AGENT-SHELL-001", priority_id: "P0", sub_class: "BE-SMOKE", detail_summary: "POST /agent/shell/data 可读数", expected_observation: "合法 Internal Key + op 返回 ok 数据；非法 Key 拒绝", endpoint_path: "/agent/shell/data", http_method: "POST", code_reference: "router/agent/shell/index.js", source_section: "Agent", category_major_id: "T5", category_minor_id: "T5_TOOL", dimension_id: "B" }),
    mk({ item_id: "BE-AGENT-SHELL-002", priority_id: "P0", sub_class: "BE-VALID", detail_summary: "shellData health_survey_goals 列与回退", expected_observation: "问卷目标可读；无 answer_js 时可回退 relate_data_id/survey_id 语义不假空", endpoint_path: "/agent/shell/data", http_method: "POST", test_input_example: "op=health_survey_goals", code_reference: "service/agent/shellData.js", source_section: "Agent", category_major_id: "T1", category_minor_id: "T1_SCHEMA", is_risk_flag: true }),
    mk({ item_id: "BE-AGENT-SHELL-003", priority_id: "P0", sub_class: "BE-STATE", detail_summary: "active_macro_plan_snapshot 五态约束", expected_observation: "同一 coach+member Active 至多 1；快照字段完整", endpoint_path: "/agent/shell/data", http_method: "POST", test_input_example: "op=active_macro_plan_snapshot", code_reference: "service/agent/shellData.js", source_section: "Agent", category_major_id: "T3", category_minor_id: "T3_STATE", dimension_id: "B", scheme_primary_id: "TS-02-BND", validation_primary_id: "VS-02-CONTRACT" }),
    mk({ item_id: "BE-AGENT-VIP-001", priority_id: "P0", sub_class: "BE-SMOKE", detail_summary: "POST /agent/user_vip/select 查找会员", expected_observation: "按昵称/条件返回会员列表或空；不走 /miniapp 加密", endpoint_path: "/agent/user_vip/select", http_method: "POST", code_reference: "router/agent/user_vip", source_section: "Agent" }),
    mk({ item_id: "BE-AGENT-VIP-002", priority_id: "P1", sub_class: "BE-STATE", detail_summary: "POST /agent/user_vip/updateRemark 写 ai_remark", expected_observation: "合法更新 remark；越权拒绝", endpoint_path: "/agent/user_vip/updateRemark", http_method: "POST", code_reference: "router/agent/user_vip", source_section: "Agent", category_major_id: "T2", category_minor_id: "T2_ROLE", is_risk_flag: true }),
    mk({ item_id: "BE-AGENT-INV-001", priority_id: "P1", sub_class: "BE-SMOKE", detail_summary: "POST /agent/invitation/listByMember", expected_observation: "返回会员在服/授权教练列表", endpoint_path: "/agent/invitation/listByMember", http_method: "POST", code_reference: "router/agent/invitation", source_section: "Agent" }),
    mk({ item_id: "BE-AGENT-EXT-001", priority_id: "P1", sub_class: "BE-SMOKE", detail_summary: "structured_extract analyze/persist", expected_observation: "analyze 返回结构；persist 落库成功或明确失败", endpoint_path: "/agent/structured_extract/analyze", http_method: "POST", code_reference: "router/agent/structured_extract", source_section: "Agent", category_major_id: "T1", category_minor_id: "T1_SCHEMA" }),
    mk({ item_id: "BE-AGENT-TC-001", priority_id: "P1", sub_class: "BE-SMOKE", detail_summary: "/agent/training_content 可写课时（若启用）", expected_observation: "合法请求可写或明确未启用；不污染 miniapp 加密路径", endpoint_path: "/agent/training_content", http_method: "POST", code_reference: "router/agent/training_content", source_section: "Agent", category_major_id: "T3", category_minor_id: "T3_FLOW", dimension_id: "B" }),
    mk({ item_id: "BE-CONV-001", priority_id: "P0", sub_class: "BE-SMOKE", detail_summary: "miniapp conversation turn 代理到 Agent", expected_observation: "合法会话可发起 turn/stream；超时配置生效", endpoint_path: "/miniapp/conversation", http_method: "POST", code_reference: "router/miniapp/conversation; service/agent", source_section: "对话", category_major_id: "T7", category_minor_id: "T7_STREAM", scheme_primary_id: "TS-05-CHAIN", validation_primary_id: "VS-04-CHAIN-OK" }),
    mk({ item_id: "BE-CONV-002", priority_id: "P0", sub_class: "BE-AUTH", detail_summary: "未登录 conversation 拒绝", expected_observation: "无 token 返回鉴权失败", endpoint_path: "/miniapp/conversation", http_method: "POST", code_reference: "router/miniapp/conversation", source_section: "对话", category_major_id: "T2", category_minor_id: "T2_ROLE", scheme_primary_id: "TS-07-NEG", validation_primary_id: "VS-09-BLOCK-H", is_risk_flag: true }),
    mk({ item_id: "BE-PLAN-001", priority_id: "P0", sub_class: "BE-STATE", detail_summary: "training_plan 确认后才写 Active", expected_observation: "草稿确认流程正确；禁止并行多 Active", endpoint_path: "/miniapp/training_plan", http_method: "POST", code_reference: "router/miniapp/training_plan", source_section: "计划", category_major_id: "T3", category_minor_id: "T3_STATE", dimension_id: "B", scheme_primary_id: "TS-05-CHAIN", validation_primary_id: "VS-04-CHAIN-OK", is_risk_flag: true }),
    mk({ item_id: "BE-PLAN-002", priority_id: "P1", sub_class: "BE-VALID", detail_summary: "plan_forms 入参校验", expected_observation: "缺必填拒绝；合法可存确认表", endpoint_path: "/miniapp/plan_forms", http_method: "POST", code_reference: "router/miniapp/plan_forms", source_section: "计划", category_major_id: "T1", category_minor_id: "T1_SCHEMA", scheme_primary_id: "TS-02-BND", validation_primary_id: "VS-01-EXACT" }),
    mk({ item_id: "BE-TC-001", priority_id: "P0", sub_class: "BE-STATE", detail_summary: "training_content 课时状态迁移", expected_observation: "draft→active→completed 合法；非法跳转拒绝", endpoint_path: "/miniapp/training_content", http_method: "POST", code_reference: "router/miniapp/training_content", source_section: "课时", category_major_id: "T3", category_minor_id: "T3_STATE", dimension_id: "B", scheme_primary_id: "TS-05-CHAIN", validation_primary_id: "VS-04-CHAIN-OK" }),
    mk({ item_id: "BE-TC-002", priority_id: "P1", sub_class: "BE-IDEM", detail_summary: "课时确认幂等", expected_observation: "重复确认不产生重复 Active 记录", endpoint_path: "/miniapp/training_content", http_method: "POST", code_reference: "router/miniapp/training_content", source_section: "课时", category_major_id: "T8", category_minor_id: "T8_IDEM", dimension_id: "R", scheme_primary_id: "TS-03-REP", validation_primary_id: "VS-01-EXACT" }),
    mk({ item_id: "BE-VIP-001", priority_id: "P1", sub_class: "BE-SMOKE", detail_summary: "miniapp vipuser 列表/详情", expected_observation: "加密通道下教练可读名下会员", endpoint_path: "/miniapp/vipuser", http_method: "POST", code_reference: "router/miniapp/user_vip", source_section: "会员" }),
    mk({ item_id: "BE-INV-001", priority_id: "P1", sub_class: "BE-AUTH", detail_summary: "invite 授权关系", expected_observation: "邀请/授权链路正确；越权不可绑他人", endpoint_path: "/miniapp/invite", http_method: "POST", code_reference: "router/miniapp/user_invitation_relation", source_section: "邀请", category_major_id: "T2", category_minor_id: "T2_ROLE", scheme_primary_id: "TS-07-NEG", validation_primary_id: "VS-09-BLOCK-H", is_risk_flag: true }),
    mk({ item_id: "BE-ASSESS-001", priority_id: "P1", sub_class: "BE-SMOKE", detail_summary: "评估五项写入与查询", expected_observation: "体成分/体态/围度/关节/体能可存可读", endpoint_path: "/miniapp/body_composition", http_method: "POST", code_reference: "router/miniapp/data_*", source_section: "评估", category_major_id: "T3", category_minor_id: "T3_FLOW", dimension_id: "B" }),
    mk({ item_id: "BE-SURVEY-001", priority_id: "P1", sub_class: "BE-SMOKE", detail_summary: "问卷答题记录", expected_observation: "survey_answer_record 可写；Agent shell 可读目标", endpoint_path: "/miniapp/survey_*", http_method: "POST", code_reference: "router/miniapp/survey_answer_record", source_section: "问卷", category_major_id: "T1", category_minor_id: "T1_SCHEMA" }),
    mk({ item_id: "BE-GROUP-001", priority_id: "P1", sub_class: "BE-SMOKE", detail_summary: "conversationGroup 会话组", expected_observation: "可创建/列表会话组；与 turn 关联正确", endpoint_path: "/miniapp/conversationGroup", http_method: "POST", code_reference: "router/miniapp/conversation_group", source_section: "对话" }),
    mk({ item_id: "BE-PUBLIC-001", priority_id: "P2", sub_class: "BE-SMOKE", detail_summary: "公共上传/ASR 通畅", expected_observation: "/public 上传或 ASR 探针可通", endpoint_path: "/public/uploadFile", http_method: "POST", code_reference: "router/common; router/public", source_section: "公共" }),
    mk({ item_id: "BE-BOUND-001", priority_id: "P0", sub_class: "BE-AUTH", detail_summary: "Agent 模块接口不依赖 miniapp 加密", expected_observation: "/agent/* 明文 JSON + Internal Key；与 /miniapp 隔离", endpoint_path: "/agent/shell/data", http_method: "POST", code_reference: "router/index.js", source_section: "边界", category_major_id: "T2", category_minor_id: "T2_CAPABILITY", is_risk_flag: true, tags: ["BE", "T2", "BOUNDARY"] }),
  ];
}

function loadAgCases() {
  const path = join(testgenRoot, "database/tables/test_item_detail/data.json");
  const rows = JSON.parse(readFileSync(path, "utf8"));
  return rows
    .filter((r) => String(r.item_id || "").startsWith("PI-"))
    .map((r) => {
      const { exec_env_name, env_tier_name, ...rest } = r;
      return {
        ...rest,
        project_code: "fitness-agent",
        project_name: "启炼 Agent · Pi",
        tags: Array.isArray(rest.tags) ? [...new Set(["AG", "PI", ...(rest.tags || [])])] : ["AG", "PI"],
        notes: rest.notes || "真源：fitness-agent/.pi；规则 fitness-agent-test-docs",
        is_active: true,
      };
    });
}

function emptyLinkTable(tableDir, note) {
  const dataFile = join(tableDir, "data.json");
  const initFile = join(tableDir, "init.sql");
  writeFileSync(dataFile, "[]\n");
  const raw = readFileSync(initFile, "utf8");
  const ddl = raw.split("\n-- 数据导入")[0];
  writeFileSync(initFile, `${ddl}\n-- 数据导入（0 条 · ${note}）\n`);
  console.log("emptied", tableDir);
}

function rewriteItemDetail(targetDir, cases) {
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(join(targetDir, "data.json"), `${JSON.stringify(cases, null, 2)}\n`);
  const initFile = join(targetDir, "init.sql");
  const raw = readFileSync(initFile, "utf8");
  const ddlLines = raw.split(/\r?\n/).filter((l) => !/^\s*INSERT\s+INTO/i.test(l) && !/^\s*--\s*数据导入/.test(l));
  while (ddlLines.length && !ddlLines[ddlLines.length - 1].trim()) ddlLines.pop();
  const inserts = cases.map(buildInsert);
  writeFileSync(
    initFile,
    `${ddlLines.join("\n")}\n\n-- 数据导入（${cases.length} 条 · 三端三项目）\n${inserts.join("\n")}\n`,
  );
  writeFileSync(
    join(targetDir, "表说明.md"),
    `# test_item_detail · 三端三项目\n\n> 共 **${cases.length}** 条。项目：\`lejian-wx-miniapp\` / \`lejian-business-service\` / \`fitness-agent\`。\n\n分类仍用通用 **T1–T12**（见 fitness-agent-test-docs）。重置本表即注入三端用例。\n`,
  );
  console.log("wrote", targetDir, cases.length);
}

function rewriteProjects() {
  const dir = join(testgenRoot, "database/tables/test_project");
  writeFileSync(join(dir, "data.json"), `${JSON.stringify(PROJECTS, null, 2)}\n`);
  const raw = readFileSync(join(dir, "init.sql"), "utf8");
  const ddlLines = raw.split(/\r?\n/).filter((l) => !/^\s*INSERT\s+INTO/i.test(l) && !/^\s*--\s*数据导入/.test(l));
  while (ddlLines.length && !ddlLines[ddlLines.length - 1].trim()) ddlLines.pop();
  const inserts = PROJECTS.map((p) => {
    const urls = sqlVal(p.repo_urls);
    const cicd = sqlVal(p.cicd_config);
    const roles = sqlVal(p.member_roles);
    return `INSERT INTO test_project (project_code, project_name, team, status, description, repo_urls, cicd_config, member_roles, last_active_at) VALUES ('${p.project_code}', '${p.project_name}', '${p.team}', '${p.status}', '${String(p.description).replace(/'/g, "''")}', ${urls}, ${cicd}, ${roles}, NOW()) ON CONFLICT (project_code) DO UPDATE SET project_name = EXCLUDED.project_name, description = EXCLUDED.description, updated_at = NOW();`;
  });
  writeFileSync(join(dir, "init.sql"), `${ddlLines.join("\n")}\n\n-- 数据导入（${PROJECTS.length} 条 · 三端项目）\n${inserts.join("\n")}\n`);
  console.log("projects", PROJECTS.map((p) => p.project_code).join(", "));
}

function updateMajorCounts(cases) {
  const majorDataFile = join(testgenRoot, "database/tables/test_category_major/data.json");
  const majorInitFile = join(testgenRoot, "database/tables/test_category_major/init.sql");
  const majors = JSON.parse(readFileSync(majorDataFile, "utf8"));
  const counts = {};
  for (const r of cases) counts[r.category_major_id] = (counts[r.category_major_id] || 0) + 1;
  for (const m of majors) m.item_count = counts[m.category_major_id] || 0;
  writeFileSync(majorDataFile, `${JSON.stringify(majors, null, 2)}\n`);
  let init = readFileSync(majorInitFile, "utf8");
  for (const m of majors) {
    const re = new RegExp(
      `(INSERT INTO test_category_major[^;]*'${m.category_major_id}'[^;]*item_count, default_scheme_id\\) VALUES \\('${m.category_major_id}', '[^']+', '[^']+', '[^']+', )\\d+`,
    );
    init = init.replace(re, `$1${m.item_count}`);
  }
  writeFileSync(majorInitFile, init);
  console.log("major counts", counts);
}

function mdTable(rows, headers) {
  const lines = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  for (const r of rows) lines.push(`| ${headers.map((h) => String(r[h] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`);
  return lines.join("\n");
}

function writeCatalogMd(outPath, cases) {
  const byProj = {};
  for (const c of cases) (byProj[c.project_code] ||= []).push(c);
  let body = `# 三端测试用例目录（FE / BE / AG）

> **版本**：2026-10-14 · **条目**：${cases.length}  
> **规则**：\`fitness-agent-test-docs\` 通用 **T1–T12**；三端拆为三个 \`project_code\`。  
> **种子**：\`database/tables/test_item_detail\`（已清空旧数据后重建）  
> **注入**：\`test-project/import-triad-cases.mjs\`

## 项目

| project_code | 名称 | 条数 | 被测仓库 |
|--------------|------|------|----------|
| lejian-wx-miniapp | 启炼前端 · 微信小程序 | ${(byProj["lejian-wx-miniapp"] || []).length} | lejian-wx-miniapp |
| lejian-business-service | 启炼服务端 · 业务 API | ${(byProj["lejian-business-service"] || []).length} | lejian-business-service |
| fitness-agent | 启炼 Agent · Pi | ${(byProj["fitness-agent"] || []).length} | fitness-agent/.pi |

## 重置 / 注入

\`\`\`bash
# 方式 A：重置 Postgres 种子（推荐本地全量）
cd admin-management-station/project-sub/testgen-sub/deploy
ams-testgen db:reset test_project test_item_detail test_item_prefix_scheme test_item_risk_link test_item_prd_ref_link test_item_prd_goal_link test_item_arch_ref_link test_category_major

# 方式 B：API 注入（需 testgen 已启动）
cd ../test-project
set TESTGEN_BASE_URL=http://127.0.0.1:5202
node import-triad-cases.mjs
\`\`\`

API 注入会：软删现有用例 → 确保三项目存在（\`/api/projects\`）→ \`POST /api/fitness/items/manual\` 逐条写入。

`;

  for (const [code, list] of Object.entries(byProj)) {
    const name = PROJECTS.find((p) => p.project_code === code)?.project_name || code;
    body += `\n## ${name}（\`${code}\`）\n\n`;
    body += mdTable(
      list.map((x) => ({
        item_id: x.item_id,
        大类: x.category_major_id,
        子类: x.sub_class,
        摘要: x.detail_summary,
        预期: x.expected_observation,
        优先级: x.priority_id,
        角色: x.role_scope_id,
      })),
      ["item_id", "大类", "子类", "摘要", "预期", "优先级", "角色"],
    );
    body += "\n";
  }

  writeFileSync(outPath, body);
  console.log("wrote", outPath);
}

function writeImportScript(outPath, casesPath) {
  const script = `#!/usr/bin/env node
/**
 * 三端用例注入 testgen-sub
 *
 * 1) 软删现有 test_item_detail（is_active=false）
 * 2) 确保三项目存在
 * 3) POST /api/fitness/items/manual 写入 cases-all.json
 *
 * Usage:
 *   set TESTGEN_BASE_URL=http://127.0.0.1:7001
 *   set TESTGEN_TOKEN=   (可选)
 *   node import-triad-cases.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.TESTGEN_BASE_URL || "http://127.0.0.1:5202").replace(/\\/$/, "");
const TOKEN = process.env.TESTGEN_TOKEN || "";
const CASES = JSON.parse(readFileSync(join(here, "cases-all.json"), "utf8"));

const PROJECTS = ${JSON.stringify(PROJECTS, null, 2)};

function headers(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  if (TOKEN) h.Authorization = \`Bearer \${TOKEN}\`;
  return h;
}

async function req(method, path, body) {
  const res = await fetch(\`\${BASE}\${path}\`, {
    method,
    headers: headers(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || res.statusText;
    throw new Error(\`\${method} \${path} → \${res.status} \${msg}\`);
  }
  return data;
}

async function ensureProjects() {
  for (const p of PROJECTS) {
    try {
      await req("POST", "/api/projects", {
        project_code: p.project_code,
        project_name: p.project_name,
        team: p.team,
        status: p.status,
        description: p.description,
        repo_urls: p.repo_urls,
      });
      console.log("[project OK]", p.project_code);
    } catch (e) {
      // 已存在则尝试更新
      try {
        await req("PUT", \`/api/projects/\${encodeURIComponent(p.project_code)}\`, {
          project_name: p.project_name,
          description: p.description,
          status: p.status,
        });
        console.log("[project UPD]", p.project_code);
      } catch (e2) {
        console.warn("[project SKIP]", p.project_code, e.message);
      }
    }
  }
}

async function clearItems() {
  // 软删全部（无筛选条件时 where 为空则更新全表）
  const data = await req("DELETE", "/api/fitness/items");
  console.log("[clear]", JSON.stringify(data?.data || data));
}

function toBody(row) {
  return {
    project_code: row.project_code,
    project_name: row.project_name,
    item_id: row.item_id,
    item_name: row.item_name,
    detail_summary: row.detail_summary,
    expected_observation: row.expected_observation,
    test_input_example: row.test_input_example || null,
    preconditions: row.preconditions || [],
    test_steps: row.test_steps || [],
    assertion_points: row.assertion_points || [],
    priority_id: row.priority_id || "P1",
    category_major_id: row.category_major_id,
    category_minor_id: row.category_minor_id,
    scheme_primary_id: row.scheme_primary_id || "TS-01-DET",
    validation_primary_id: row.validation_primary_id || "VS-01-EXACT",
    role_scope_id: row.role_scope_id || "ALL",
    automation_status_id: row.automation_status_id || "AUTO_TODO",
    source_doc: row.source_doc || "三端用例目录.md",
    source_section: row.source_section || null,
    code_reference: row.code_reference || null,
    endpoint_path: row.endpoint_path || null,
    http_method: row.http_method || null,
    tags: row.tags || [],
    notes: row.notes || null,
    sub_class: row.sub_class || null,
  };
}

async function main() {
  console.log("base=", BASE, "cases=", CASES.length);
  await clearItems();
  await ensureProjects();
  let ok = 0;
  let fail = 0;
  for (const row of CASES) {
    const id = row.item_id || "(no-id)";
    try {
      await req("POST", "/api/fitness/items/manual", toBody(row));
      ok += 1;
      console.log("[OK]", id);
    } catch (e) {
      fail += 1;
      console.error("[FAIL]", id, e.message);
    }
  }
  console.log(\`\\nDone. ok=\${ok} fail=\${fail}\`);
  process.exit(fail ? 2 : 0);
}

main();
`;
  writeFileSync(outPath, script);
  console.log("wrote", outPath, "(reads", casesPath, ")");
}

function writeProjectReadmes(cases) {
  const fe = cases.filter((c) => c.project_code === "lejian-wx-miniapp");
  const be = cases.filter((c) => c.project_code === "lejian-business-service");
  const ag = cases.filter((c) => c.project_code === "fitness-agent");
  writeFileSync(
    join(testgenRoot, "test-project/lejian-wx-miniapp/README.md"),
    `# lejian-wx-miniapp · 前端测试项目\n\n> 条数：**${fe.length}** · \`project_code=lejian-wx-miniapp\`\n\n真源：\`lejian-wx-miniapp\`（聊天壳、卡片、分包页面）。分类以 T10 为主，权限/流式分别落 T2/T7。\n\n全量目录见 [../triad-cases.md](../triad-cases.md)。\n`,
  );
  writeFileSync(
    join(testgenRoot, "test-project/lejian-business-service/README.md"),
    `# lejian-business-service · 服务端测试项目\n\n> 条数：**${be.length}** · \`project_code=lejian-business-service\`\n\n真源：\`router/agent/*\` 与 \`router/miniapp/*\`。覆盖壳读数、计划/课时状态、对话代理与鉴权边界。\n\n全量目录见 [../triad-cases.md](../triad-cases.md)。\n`,
  );
  writeFileSync(
    join(testgenRoot, "test-project/fitness-agent/README.md"),
    `# fitness-agent · Agent 测试项目\n\n> 条数：**${ag.length}** · \`project_code=fitness-agent\`\n\n真源：\`fitness-agent/.pi\`（PI-*，与 fitness-agent-test-docs 对齐）。\n\n全量目录见 [../triad-cases.md](../triad-cases.md)。历史站级文档仍可参考本目录其它 md。\n`,
  );
}

// ─── main ─────────────────────────────────────────────────────────
const fe = buildFeCases();
const be = buildBeCases();
const ag = loadAgCases();
const ALL = [...fe, ...be, ...ag];

console.log(`FE=${fe.length} BE=${be.length} AG=${ag.length} TOTAL=${ALL.length}`);

// 清空关联表
for (const name of [
  "test_item_risk_link",
  "test_item_prd_ref_link",
  "test_item_prd_goal_link",
  "test_item_arch_ref_link",
]) {
  emptyLinkTable(join(testgenRoot, "database/tables", name), "三端重建清空");
}

rewriteProjects();
rewriteItemDetail(join(testgenRoot, "database/tables/test_item_detail"), ALL);
updateMajorCounts(ALL);

const outRoot = join(testgenRoot, "test-project");
writeFileSync(join(outRoot, "cases-all.json"), `${JSON.stringify(ALL, null, 2)}\n`);
writeCatalogMd(join(outRoot, "triad-cases.md"), ALL);
writeImportScript(join(outRoot, "import-triad-cases.mjs"), "cases-all.json");
writeProjectReadmes(ALL);

writeFileSync(
  join(outRoot, "README.md"),
  `# 三端测试项目（FE / BE / AG）

| 项目 | 目录 | project_code |
|------|------|--------------|
| 前端 | [lejian-wx-miniapp/](./lejian-wx-miniapp/) | \`lejian-wx-miniapp\` |
| 服务端 | [lejian-business-service/](./lejian-business-service/) | \`lejian-business-service\` |
| Agent | [fitness-agent/](./fitness-agent/) | \`fitness-agent\` |

- **用例目录 MD**：[triad-cases.md](./triad-cases.md)
- **注入脚本**：[import-triad-cases.mjs](./import-triad-cases.mjs) + [cases-all.json](./cases-all.json)
- **生成器**：[scripts/generate-triad-cases.mjs](./scripts/generate-triad-cases.mjs)
- **规则**：上游 \`fitness-agent-test-docs\`（T1–T12）

\`\`\`bash
node test-project/scripts/generate-triad-cases.mjs
# 然后 db:reset 或 node test-project/import-triad-cases.mjs
\`\`\`
`,
);

if (fitnessDocs) {
  try {
    rewriteItemDetail(join(fitnessDocs, "数据库详细表/test_item_detail"), ALL);
    writeFileSync(
      join(fitnessDocs, "数据库详细表/README.md"),
      `# 数据库详细表（三端三项目）\n\n测试项：**${ALL.length}** 条（\`test_item_detail\`）。\n\n由 \`testgen-sub/test-project/scripts/generate-triad-cases.mjs\` 生成。\n`,
    );
    writeCatalogMd(join(fitnessDocs, "三端用例目录.md"), ALL);
  } catch (e) {
    console.warn("fitness-agent-test-docs sync skip:", e.message);
  }
}

console.log("\nDONE. Next:");
console.log("  ams-testgen db:reset test_project test_item_detail test_item_prefix_scheme test_item_risk_link test_item_prd_ref_link test_item_prd_goal_link test_item_arch_ref_link test_category_major");
console.log("  # or: node test-project/import-triad-cases.mjs");
