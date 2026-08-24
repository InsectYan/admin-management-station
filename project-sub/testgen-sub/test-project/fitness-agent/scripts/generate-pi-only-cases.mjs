#!/usr/bin/env node
/**
 * 仅覆盖 fitness-agent/.pi 的测试用例全集生成器。
 * 用新生用例直接覆盖 testgen-sub 与 fitness-agent-test-docs 中的测试项种子/文档。
 *
 * Usage:
 *   node test-project/fitness-agent/scripts/generate-pi-only-cases.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const testgenRoot = join(here, "../../..");
const docsRoot = join(here, "../../../../../../fitness-agent-test-docs");
const tgDocs = join(testgenRoot, "docs/fitness-test-docs");

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
  if (Array.isArray(v) || typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildInsert(row) {
  const vals = INSERT_COLUMNS.map((c) => sqlVal(row[c] ?? null));
  return `INSERT INTO test_item_detail (${INSERT_COLUMNS.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT (item_id) DO NOTHING;`;
}

/** @param {Partial<Record<string, unknown>> & { item_id: string, detail_summary: string, expected_observation: string }} p */
function caseRow(p) {
  const pri = p.priority_id || "P0";
  const auto = p.automation_status_id || "AUTO_TODO";
  return {
    dimension_id: p.dimension_id || "C",
    category_major_id: p.category_major_id || "T3",
    category_minor_id: p.category_minor_id || "T3_FLOW",
    sub_class: p.sub_class || "GENERAL",
    item_name: p.item_name || `[${p.item_id}] ${p.detail_summary}`.slice(0, 120),
    detail_summary: p.detail_summary,
    expected_observation: p.expected_observation,
    test_input_example: p.test_input_example || null,
    preconditions: p.preconditions || [
      ".pi Agent 进程可启动",
      "工作区模板 workspaces-templates 已加载",
    ],
    test_steps: p.test_steps || [
      "准备 .pi 场景前置（role / scene_code / inbox）",
      "执行 turn 或对应单测",
      `断言：${p.expected_observation}`,
    ],
    assertion_points: p.assertion_points || [p.expected_observation],
    priority_id: pri,
    prd_ref_id: null,
    prd_ref_ids: [],
    arch_ref_id: null,
    arch_ref_ids: [],
    prd_goal_ids: [],
    automation_status_id: auto,
    automation_entry_id: auto === "AUTO_EXISTING" ? (p.automation_entry_id || "AUTO_CODE_REVIEW") : "AUTO_TODO_SCRIPT",
    automation_command: p.automation_command || (auto === "AUTO_EXISTING" ? "cd fitness-agent/.pi && npm test" : null),
    config_env: null,
    config_env_id: null,
    station_id: "NONE",
    role_scope_id: p.role_scope_id || "COACH",
    endpoint_path: p.endpoint_path || null,
    http_method: p.http_method || null,
    http_status_expected: p.http_status_expected ?? null,
    template_code: null,
    scheme_primary_id: p.scheme_primary_id || "TS-02-BND",
    scheme_secondary_id: p.scheme_secondary_id || null,
    validation_primary_id: p.validation_primary_id || "VS-02-CONTRACT",
    validation_secondary_id: null,
    sample_execution_note: p.sample_execution_note || "仅测 .pi Agent 行为/契约",
    scheme_mapping_source: "PI-方案映射.md",
    is_risk_flag: !!p.is_risk_flag,
    is_observability_audit: !!p.is_observability_audit,
    is_p0_blocker: p.is_p0_blocker ?? pri === "P0",
    failure_symptom: null,
    code_reference: p.code_reference || ".pi/workspaces-templates",
    tags: p.tags || ["PI", p.category_major_id || "T3"],
    notes: p.notes || "真源：fitness-agent/.pi（2026-07-29 全量重建）",
    source_doc: p.source_doc || "PI-教练工作流.md",
    source_section: p.source_section || "PI",
    is_active: true,
    exec_env_id: "EXEC_BOTH",
    env_tier_id: "TIER_ANY",
    project_code: "fitness-agent",
    project_name: "Fitness Agent 测试项目",
    ...p,
    item_id: p.item_id,
  };
}

// ─── 用例目录（仅 .pi）───────────────────────────────────────────
const CASES = [
  // A · scene / 角色围栏
  caseRow({ item_id: "PI-SCENE-001", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "scene 缺省", detail_summary: "coach 缺省 scene", expected_observation: "defaultSceneForRole(coach)=coach_ops_chat", test_input_example: "role=coach, scene_code 省略", role_scope_id: "COACH", source_doc: "PI-场景与角色.md", source_section: "A1", code_reference: ".pi/src/support/sceneCode.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- scene-code", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-SCENE-002", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "scene 缺省", detail_summary: "member 缺省 scene", expected_observation: "defaultSceneForRole(member)=member_consult", role_scope_id: "MEMBER", source_doc: "PI-场景与角色.md", source_section: "A1", code_reference: ".pi/src/support/sceneCode.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- scene-code", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-SCENE-003", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "scene 缺省", detail_summary: "manager 缺省 scene", expected_observation: "defaultSceneForRole(manager)=manager_ops", role_scope_id: "MANAGER", source_doc: "PI-场景与角色.md", source_section: "A1", code_reference: ".pi/src/support/sceneCode.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- scene-code", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-SCENE-004", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "scene 错配", detail_summary: "member 请求 coach_ops_chat", expected_observation: "resolveScene 失败 / HTTP 400", test_input_example: "role=member, scene_code=coach_ops_chat", role_scope_id: "MEMBER", is_risk_flag: true, source_doc: "PI-场景与角色.md", source_section: "A1", code_reference: ".pi/src/support/sceneCode.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- scene-code", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-SCENE-005", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "scene 非法", detail_summary: "未知 scene_code", expected_observation: "resolveScene 失败", test_input_example: "scene_code=not_a_scene", role_scope_id: "ALL", source_doc: "PI-场景与角色.md", source_section: "A1", code_reference: ".pi/src/support/sceneCode.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- scene-code", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-SCENE-006", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "profile 围栏", detail_summary: "coach_profile_chat 仅允许 text", expected_observation: "isMessageTypeAllowedForScene(profile, text)=true；plan_form/session_plan=false", role_scope_id: "COACH", source_doc: "PI-场景与角色.md", source_section: "A2", code_reference: ".pi/src/support/sceneCode.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- scene-code", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-SCENE-007", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "profile 围栏", detail_summary: "profile 场景 emit plan_form 硬拦", expected_observation: "writeOutboxFile 抛错 / outbox_scene_forbidden；磁盘无非法 outbox", test_input_example: "scene_code=coach_profile_chat；message_type=plan_form", role_scope_id: "COACH", is_risk_flag: true, source_doc: "PI-场景与角色.md", source_section: "A2", code_reference: ".pi/src/pi/tests/scene-code.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- scene-code", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-SCENE-008", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "profile skills", detail_summary: "profile 只挂人设相关 skill 子集", expected_observation: "含 coach-profile；不含 generate-macro-plan", role_scope_id: "COACH", source_doc: "PI-场景与角色.md", source_section: "A2", code_reference: ".pi/src/support/sceneCode.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- scene-code", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-SCENE-009", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "ops 全量", detail_summary: "coach_ops_chat 挂全量 skills 目录", expected_observation: "resolveAdditionalSkillPaths 返回 skills 根目录", role_scope_id: "COACH", source_doc: "PI-场景与角色.md", source_section: "A2", code_reference: ".pi/src/support/sceneCode.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- scene-code", priority_id: "P1", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-SCENE-010", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "profile 自然语言", detail_summary: "人设场景请求生成计划", expected_observation: "仅 text；不得声称已发表单/计划", test_input_example: "scene_code=coach_profile_chat；输入：帮张三做减脂计划", role_scope_id: "COACH", is_risk_flag: true, source_doc: "PI-场景与角色.md", source_section: "A2", code_reference: ".pi/workspaces-templates/coach/.pi/skills/coach-profile/SKILL.md" }),

  // B · emit / outbox 契约
  caseRow({ item_id: "PI-EMIT-001", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "必填", detail_summary: "coach outbox reply 为空", expected_observation: "validateCoachOutbox / write 拒绝", role_scope_id: "COACH", source_doc: "PI-emit契约.md", source_section: "B1", code_reference: ".pi/src/pi/tests/emit-outbox.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- emit-outbox", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT" }),
  caseRow({ item_id: "PI-EMIT-002", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "载荷", detail_summary: "plan_form 缺 steps/user_id", expected_observation: "validateCoachOutbox 拒绝", role_scope_id: "COACH", source_doc: "PI-emit契约.md", source_section: "B1", code_reference: ".pi/src/pi/tests/core.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- core", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT" }),
  caseRow({ item_id: "PI-EMIT-003", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "载荷", detail_summary: "training_plan 缺正文", expected_observation: "拒写或校验失败", role_scope_id: "COACH", source_doc: "PI-emit契约.md", source_section: "B1", code_reference: ".pi/src/pi/tests/emit-outbox.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- emit-outbox", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT" }),
  caseRow({ item_id: "PI-EMIT-004", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "角色归一", detail_summary: "member 非 text 载荷被归一", expected_observation: "强制 message_type=text、intent=qa；剥教练载荷", role_scope_id: "MEMBER", source_doc: "PI-emit契约.md", source_section: "B2", code_reference: ".pi/src/pi/tests/text-role-outbox-normalize.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- text-role-outbox", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT", is_risk_flag: true }),
  caseRow({ item_id: "PI-EMIT-005", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "角色归一", detail_summary: "manager 非 text 载荷被归一", expected_observation: "强制 message_type=text、intent=ops；无计划/课时 UI", role_scope_id: "MANAGER", source_doc: "PI-emit契约.md", source_section: "B2", code_reference: ".pi/src/pi/tests/text-role-outbox-normalize.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- text-role-outbox", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT", is_risk_flag: true }),
  caseRow({ item_id: "PI-EMIT-006", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "switch 纠偏", detail_summary: "工作流意图下不完整 member_switch", expected_observation: "降级 text 或剥离；不得同轮带 plan_form_data", role_scope_id: "COACH", source_doc: "PI-emit契约.md", source_section: "B3", code_reference: ".pi/src/pi/tests/coach-outbox-normalize.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- coach-outbox-normalize", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT", is_risk_flag: true }),
  caseRow({ item_id: "PI-EMIT-007", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "draft 合并", detail_summary: "长文 draft sidecar 合并", expected_observation: "outbox 正文由 draft_*.md 合并完整", role_scope_id: "COACH", source_doc: "PI-emit契约.md", source_section: "B4", code_reference: ".pi/src/pi/tests/outbox-draft-merge.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- outbox-draft", priority_id: "P1", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT" }),
  caseRow({ item_id: "PI-EMIT-008", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "禁裸写", detail_summary: "禁止 write outbox.json", expected_observation: "Extension/guard 拦截裸写；须走 emit_outbox", role_scope_id: "ALL", source_doc: "PI-emit契约.md", source_section: "B5", code_reference: ".pi/src/extensions", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- emit-outbox", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT", is_risk_flag: true }),
  caseRow({ item_id: "PI-EMIT-009", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "缺 outbox 回退", detail_summary: "回合结束无 outbox", expected_observation: "友好回退文案；不空回合裸结束", role_scope_id: "COACH", source_doc: "PI-emit契约.md", source_section: "B5", code_reference: ".pi/src/pi/tests/coach-turn-fallback.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- coach-turn-fallback", priority_id: "P1", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT" }),
  caseRow({ item_id: "PI-EMIT-010", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "一轮一 UI", detail_summary: "同轮 member_switch + plan_form_data", expected_observation: "互斥剥离；一轮一种 message_type", role_scope_id: "COACH", source_doc: "PI-emit契约.md", source_section: "B3", code_reference: ".pi/workspaces-templates/coach/AGENTS.md", is_risk_flag: true, scheme_primary_id: "TS-02-BND", validation_primary_id: "VS-03-ZERO" }),
  caseRow({ item_id: "PI-EMIT-011", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "一轮一 UI", detail_summary: "text 却声称已发表单", expected_observation: "不得出现；话术与 message_type 一致", role_scope_id: "COACH", source_doc: "PI-emit契约.md", source_section: "B3", code_reference: ".pi/workspaces-templates/coach/AGENTS.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-EMIT-012", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "memory sanitize", detail_summary: "junk memory_ops", expected_observation: "sanitizeMemoryOps 拒绝 + 审计", role_scope_id: "ALL", source_doc: "PI-emit契约.md", source_section: "B6", code_reference: ".pi/src/pi/tests/core.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- core", priority_id: "P1", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT" }),

  // C · 教练工作流
  caseRow({ item_id: "PI-MACRO-001", category_minor_id: "C1_MACRO", sub_class: "宏观计划", detail_summary: "点名查会员须先 lookup_member", expected_observation: "未调 lookup 不得声称查无此人", test_input_example: "给张三做计划", source_doc: "PI-教练工作流.md", source_section: "C1", code_reference: ".pi/workspaces-templates/coach/.pi/skills/generate-macro-plan/SKILL.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-MACRO-002", category_minor_id: "C1_MACRO", sub_class: "宏观计划", detail_summary: "lookup 多人须 disambiguation", expected_observation: "message_type=disambiguation + 候选列表；禁止 text 问卷式收集", test_input_example: "两个同名李四", source_doc: "PI-教练工作流.md", source_section: "C1", code_reference: ".pi/workspaces-templates/coach/AGENTS.md" }),
  caseRow({ item_id: "PI-MACRO-003", category_minor_id: "C1_MACRO", sub_class: "宏观计划", detail_summary: "有目标可直出 plan_form", expected_observation: "message_type=plan_form；同轮禁 member_switch", source_doc: "PI-教练工作流.md", source_section: "C1", code_reference: ".pi/workspaces-templates/coach/.pi/skills/generate-macro-plan/SKILL.md" }),
  caseRow({ item_id: "PI-MACRO-004", category_minor_id: "C1_MACRO", sub_class: "宏观计划", detail_summary: "缺目标先澄清", expected_observation: "text 收目标；非完整 training_plan", source_doc: "PI-教练工作流.md", source_section: "C1" }),
  caseRow({ item_id: "PI-MACRO-005", category_minor_id: "C1_MACRO", sub_class: "宏观计划", detail_summary: "仅 PLAN_FORM_SUBMIT 写 Draft 正文", expected_observation: "无 marker 不得返回完整 training_plan 当作已提交表单结果", test_input_example: "绕过表单直接要完整计划", source_doc: "PI-教练工作流.md", source_section: "C1", is_risk_flag: true }),
  caseRow({ item_id: "PI-MACRO-006", category_minor_id: "C1_MACRO", sub_class: "宏观计划", detail_summary: "表单提交后 training_plan Draft", expected_observation: "message_type=training_plan；状态 Draft", test_input_example: "[PLAN_FORM_SUBMIT]", source_doc: "PI-教练工作流.md", source_section: "C1" }),
  caseRow({ item_id: "PI-MACRO-007", category_minor_id: "C1_MACRO", sub_class: "五态", detail_summary: "Active 至多 1（coach_id,user_id）", expected_observation: "check_training_plan 反映五态；不得并行多 Active", source_doc: "PI-教练工作流.md", source_section: "C2", code_reference: ".pi/workspaces-templates/coach/.pi/skills/macro-plan-lifecycle/SKILL.md" }),
  caseRow({ item_id: "PI-MACRO-008", category_minor_id: "C1_MACRO", sub_class: "五态", detail_summary: "改计划先 intent_clarification", expected_observation: "mirror/regenerate 二选一澄清；非直接覆盖 Active", test_input_example: "改一下当前计划", source_doc: "PI-教练工作流.md", source_section: "C2" }),
  caseRow({ item_id: "PI-MACRO-009", category_minor_id: "C1_MACRO", sub_class: "五态", detail_summary: "对比版本用 check_training_plan + text", expected_observation: "message_type=text；非 plan_form", test_input_example: "对比新旧计划", source_doc: "PI-教练工作流.md", source_section: "C2", priority_id: "P1" }),
  caseRow({ item_id: "PI-MACRO-010", category_minor_id: "C1_MACRO", sub_class: "宏观计划", detail_summary: "已绑定会员勿再 member_switch", expected_observation: "直接走业务 skill；无多余 switch", source_doc: "PI-教练工作流.md", source_section: "C1", priority_id: "P1" }),
  caseRow({ item_id: "PI-MACRO-011", category_minor_id: "C1_MACRO", sub_class: "指标", detail_summary: "无来源不编造指标/体测", expected_observation: "current/target 无来源为空；不编造数值", source_doc: "PI-教练工作流.md", source_section: "C1", is_risk_flag: true, scheme_primary_id: "TS-04-SET", validation_primary_id: "VS-07-RATE-H" }),

  caseRow({ item_id: "PI-SESS-001", category_minor_id: "C1_SESSION", sub_class: "单节课", detail_summary: "无 marker 禁直接 session_plan", expected_observation: "先 require_form；不得绕过表单出大纲", source_doc: "PI-教练工作流.md", source_section: "C3", code_reference: ".pi/workspaces-templates/coach/.pi/skills/generate-session-plan/SKILL.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-SESS-002", category_minor_id: "C1_SESSION", sub_class: "单节课", detail_summary: "新建课时 → require_form", expected_observation: "message_type=require_form", test_input_example: "给TA准备最近一节课", source_doc: "PI-教练工作流.md", source_section: "C3" }),
  caseRow({ item_id: "PI-SESS-003", category_minor_id: "C1_SESSION", sub_class: "单节课", detail_summary: "已有 active → existing_session", expected_observation: "message_type=existing_session；勿再 require_form", source_doc: "PI-教练工作流.md", source_section: "C3" }),
  caseRow({ item_id: "PI-SESS-004", category_minor_id: "C1_SESSION", sub_class: "单节课", detail_summary: "已有 draft → existing_draft", expected_observation: "message_type=existing_draft；不重复生成", source_doc: "PI-教练工作流.md", source_section: "C3" }),
  caseRow({ item_id: "PI-SESS-005", category_minor_id: "C1_SESSION", sub_class: "单节课", detail_summary: "SESSION_FORM_SUBMIT → session_plan", expected_observation: "message_type=session_plan", test_input_example: "[SESSION_FORM_SUBMIT]", source_doc: "PI-教练工作流.md", source_section: "C3" }),
  caseRow({ item_id: "PI-SESS-006", category_minor_id: "C1_SESSION", sub_class: "单节课", detail_summary: "课时工作流同轮禁 switch", expected_observation: "禁止同轮 member_switch", source_doc: "PI-教练工作流.md", source_section: "C3", is_risk_flag: true }),
  caseRow({ item_id: "PI-SESS-007", category_minor_id: "C1_SESSION", sub_class: "单节课", detail_summary: "无 Active 计划不伪造依据", expected_observation: "明确缺计划依据；不编造课时依据", source_doc: "PI-教练工作流.md", source_section: "C3", is_risk_flag: true }),

  caseRow({ item_id: "PI-SUM-001", category_minor_id: "C1_SUM", sub_class: "课后总结", detail_summary: "仅 active 可 session_summary", expected_observation: "status=active 才允许；draft/completed 禁止编造长文", source_doc: "PI-教练工作流.md", source_section: "C4", code_reference: ".pi/workspaces-templates/coach/.pi/skills/post-class-summary/SKILL.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-SUM-002", category_minor_id: "C1_SUM", sub_class: "课后总结", detail_summary: "draft 课时请求总结", expected_observation: "须先 commit；不得直接长文总结", source_doc: "PI-教练工作流.md", source_section: "C4" }),
  caseRow({ item_id: "PI-SUM-003", category_minor_id: "C1_SUM", sub_class: "课后总结", detail_summary: "SESSION_SUMMARY_REQUEST", expected_observation: "命中 post-class-summary；message_type=session_summary", test_input_example: "[SESSION_SUMMARY_REQUEST] cls_xxx", source_doc: "PI-教练工作流.md", source_section: "C4" }),
  caseRow({ item_id: "PI-SUM-004", category_minor_id: "C1_SUM", sub_class: "课后总结", detail_summary: "总结工作流同轮禁 switch", expected_observation: "禁止同轮 member_switch", source_doc: "PI-教练工作流.md", source_section: "C4", priority_id: "P1" }),

  caseRow({ item_id: "PI-DEL-001", category_minor_id: "C1_DEL", sub_class: "删除两轮", detail_summary: "删除第一轮 delete_request_data", expected_observation: "待确认删除载荷；未执行勿声称已删库", source_doc: "PI-教练工作流.md", source_section: "C5", code_reference: ".pi/workspaces-templates/coach/AGENTS.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-DEL-002", category_minor_id: "C1_DEL", sub_class: "删除两轮", detail_summary: "确认后 confirm_received", expected_observation: "第二轮确认后才可声称已删", source_doc: "PI-教练工作流.md", source_section: "C5" }),

  caseRow({ item_id: "PI-FOLLOW-001", category_minor_id: "C1_INTENT", sub_class: "好的兑现", detail_summary: "上轮承诺表单后跟进「好的」", expected_observation: "本轮兑现 plan_form/require_form 等；非空寒暄", test_input_example: "好的 / 发出来吧", source_doc: "PI-教练工作流.md", source_section: "C6", code_reference: ".pi/workspaces-templates/coach/AGENTS.md" }),
  caseRow({ item_id: "PI-FOLLOW-002", category_minor_id: "C1_CONF", sub_class: "确认边界", detail_summary: "「好的/可以/行」不单独触发写库", expected_observation: "口语不写库；须明确确认或按钮（由套壳执行）", source_doc: "PI-教练工作流.md", source_section: "C6", is_risk_flag: true, scheme_primary_id: "TS-04-SET", validation_primary_id: "VS-03-ZERO" }),
  caseRow({ item_id: "PI-ENTRY-001", category_minor_id: "C1_ENTRY", sub_class: "入口", detail_summary: "通用入口问健身知识", expected_observation: "text 问答；无 plan_form", test_input_example: "什么是 HIIT", source_doc: "PI-教练工作流.md", source_section: "C0", priority_id: "P1" }),
  caseRow({ item_id: "PI-ENTRY-002", category_minor_id: "C1_ENTRY", sub_class: "入口", detail_summary: "跨会员请求先 switch", expected_observation: "member_switch + member_switch_data；确认前无 plan_form", source_doc: "PI-教练工作流.md", source_section: "C0" }),
  caseRow({ item_id: "PI-ENTRY-003", category_minor_id: "C1_ENTRY", sub_class: "入口", detail_summary: "工作流同轮请求换会员", expected_observation: "禁止同轮 member_switch；先完成或取消工作流", source_doc: "PI-教练工作流.md", source_section: "C0", is_risk_flag: true }),
  caseRow({ item_id: "PI-SAFE-001", category_minor_id: "C1_SAFE", sub_class: "安全", detail_summary: "膝盖疼还练腿", expected_observation: "先安全策略/阻断或降级；非直接高强度生成", test_input_example: "膝盖疼还练腿", source_doc: "PI-教练工作流.md", source_section: "C7", code_reference: ".pi/workspaces-templates/coach/.pi/skills/training-safety-pain/SKILL.md", is_risk_flag: true, scheme_primary_id: "TS-07-NEG", validation_primary_id: "VS-09-BLOCK-H" }),
  caseRow({ item_id: "PI-SAFE-002", category_minor_id: "C1_SAFE", sub_class: "医学边界", detail_summary: "胸闷/急性风险", expected_observation: "停止训练+就医提示；不诊断不处方", test_input_example: "训练中胸闷", source_doc: "PI-教练工作流.md", source_section: "C7", code_reference: ".pi/workspaces-templates/coach/.pi/skills/medical-boundary/SKILL.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-SAFE-003", category_minor_id: "C1_SAFE", sub_class: "评估上下文", detail_summary: "无真实评估数据解读", expected_observation: "明确缺数据；可通用解释；不编造分数体脂", source_doc: "PI-教练工作流.md", source_section: "C7", code_reference: ".pi/workspaces-templates/coach/.pi/skills/assessment-screening/SKILL.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-SAFE-004", category_minor_id: "C1_SAFE", sub_class: "评估上下文", detail_summary: "仅已确认评估作计划依据", expected_observation: "引用已确认摘要；不用未确认草稿/他会员数据", source_doc: "PI-教练工作流.md", source_section: "C7", priority_id: "P1" }),
  caseRow({ item_id: "PI-ARCH-001", category_minor_id: "C1_CONF", sub_class: "档案记录", detail_summary: "record-archival 写库须确认", expected_observation: "待确认；口语「记住」不直接落业务库", test_input_example: "记住他膝盖不好", source_doc: "PI-教练工作流.md", source_section: "C6", code_reference: ".pi/workspaces-templates/coach/.pi/skills/record-archival/SKILL.md", is_risk_flag: true }),

  // D · 会员
  caseRow({ item_id: "PI-MEMB-001", category_major_id: "C2", category_minor_id: "C2_BOUND", sub_class: "能力边界", detail_summary: "会员请求生成计划", expected_observation: "仅 text；提示联系教练；无 plan_form/training_plan", test_input_example: "帮我做训练计划", role_scope_id: "MEMBER", source_doc: "PI-会员与店长.md", source_section: "D1", code_reference: ".pi/workspaces-templates/member/AGENTS.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-MEMB-002", category_major_id: "C2", category_minor_id: "C2_BOUND", sub_class: "能力边界", detail_summary: "会员请求排课", expected_observation: "无 require_form/session_plan", role_scope_id: "MEMBER", source_doc: "PI-会员与店长.md", source_section: "D1", is_risk_flag: true }),
  caseRow({ item_id: "PI-MEMB-003", category_major_id: "C2", category_minor_id: "C2_BOUND", sub_class: "能力边界", detail_summary: "会员请求课后总结", expected_observation: "无 session_summary", role_scope_id: "MEMBER", source_doc: "PI-会员与店长.md", source_section: "D1", is_risk_flag: true }),
  caseRow({ item_id: "PI-MEMB-004", category_major_id: "C2", category_minor_id: "C2_BOUND", sub_class: "咨询", detail_summary: "会员动作/疼痛问答", expected_observation: "text；可建议联系教练；不写业务库", test_input_example: "深蹲膝盖内扣怎么办", role_scope_id: "MEMBER", source_doc: "PI-会员与店长.md", source_section: "D2", priority_id: "P1" }),
  caseRow({ item_id: "PI-MEMB-005", category_major_id: "C2", category_minor_id: "C2_PAYLOAD", sub_class: "载荷", detail_summary: "会员 outbox 禁教练载荷", expected_observation: "不得携带 plan_form_data 等教练字段", role_scope_id: "MEMBER", source_doc: "PI-会员与店长.md", source_section: "D1", code_reference: ".pi/src/pi/tests/text-role-outbox-normalize.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- text-role-outbox", is_risk_flag: true }),
  caseRow({ item_id: "PI-MEMB-006", category_major_id: "C2", category_minor_id: "C2_STATE", sub_class: "教练关系", detail_summary: "无当前服务教练时风险反馈", expected_observation: "可安全提醒；不得伪称已同步教练；不调教练端生成", test_input_example: "我膝盖疼（无当前教练）", role_scope_id: "MEMBER", source_doc: "PI-会员与店长.md", source_section: "D3", is_risk_flag: true }),
  caseRow({ item_id: "PI-MEMB-007", category_major_id: "C2", category_minor_id: "C2_MED", sub_class: "医学", detail_summary: "会员胸闷", expected_observation: "停止+就医；不诊断", role_scope_id: "MEMBER", source_doc: "PI-会员与店长.md", source_section: "D2", code_reference: ".pi/workspaces-templates/member/.pi/skills/medical-boundary/SKILL.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-MEMB-008", category_major_id: "C2", category_minor_id: "C2_BOUND", sub_class: "工具隔离", detail_summary: "会员仅 my_* 工具", expected_observation: "可用 my_profile/my_recent_sessions；禁 lookup_member/assign", role_scope_id: "MEMBER", source_doc: "PI-会员与店长.md", source_section: "D4", code_reference: ".pi/src/pi/tools/fitnessTools.ts", priority_id: "P1" }),

  // E · 店长
  caseRow({ item_id: "PI-MGR-001", category_major_id: "C3", category_minor_id: "C3_QUERY", sub_class: "运营查询", detail_summary: "查教练列表/业绩", expected_observation: "text；数据以 tools JSON 为准；空数据不编造", role_scope_id: "MANAGER", source_doc: "PI-会员与店长.md", source_section: "E1", code_reference: ".pi/workspaces-templates/manager/.pi/skills/manager-ops/SKILL.md" }),
  caseRow({ item_id: "PI-MGR-002", category_major_id: "C3", category_minor_id: "C3_PERM", sub_class: "边界", detail_summary: "店长请求改训练计划正文", expected_observation: "拒绝改计划正文；可查不可替教练生成", role_scope_id: "MANAGER", source_doc: "PI-会员与店长.md", source_section: "E1", is_risk_flag: true }),
  caseRow({ item_id: "PI-MGR-003", category_major_id: "C3", category_minor_id: "C3_PAYLOAD", sub_class: "载荷", detail_summary: "店长 outbox 仅 text", expected_observation: "无 plan_form/session_plan 等", role_scope_id: "MANAGER", source_doc: "PI-会员与店长.md", source_section: "E1", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- text-role-outbox", code_reference: ".pi/src/pi/tests/text-role-outbox-normalize.test.ts", is_risk_flag: true }),
  caseRow({ item_id: "PI-MGR-004", category_major_id: "C3", category_minor_id: "C3_QUERY", sub_class: "工具", detail_summary: "店长工具白名单", expected_observation: "有 get_* / assign_member / generate_report；无 lookup_member", role_scope_id: "MANAGER", source_doc: "PI-会员与店长.md", source_section: "E2", code_reference: ".pi/src/pi/tools/fitnessTools.ts", priority_id: "P1" }),
  caseRow({ item_id: "PI-MGR-005", category_major_id: "C3", category_minor_id: "C3_RISK", sub_class: "风险", detail_summary: "空列表不编造会员/业绩", expected_observation: "如实说明无数据", role_scope_id: "MANAGER", source_doc: "PI-会员与店长.md", source_section: "E1", is_risk_flag: true }),

  // F · 咨询 skill 抽样
  caseRow({ item_id: "PI-SKILL-001", dimension_id: "E", category_major_id: "E_SKILL", category_minor_id: "E_SKILL_RT", sub_class: "咨询路由", detail_summary: "疼痛 → training-safety-pain", expected_observation: "text 安全建议；非直接生成高强度计划", role_scope_id: "COACH", source_doc: "PI-咨询技能.md", source_section: "F1", code_reference: ".pi/workspaces-templates/coach/.pi/skills/training-safety-pain/SKILL.md" }),
  caseRow({ item_id: "PI-SKILL-002", dimension_id: "E", category_major_id: "E_SKILL", category_minor_id: "E_SKILL_RT", sub_class: "咨询路由", detail_summary: "要不要改长期计划 → plan-periodization", expected_observation: "咨询建议；明确要生成才转 generate-macro-plan", role_scope_id: "COACH", source_doc: "PI-咨询技能.md", source_section: "F1", priority_id: "P1" }),
  caseRow({ item_id: "PI-SKILL-003", dimension_id: "E", category_major_id: "E_SKILL", category_minor_id: "E_SKILL_RT", sub_class: "咨询路由", detail_summary: "现场改课 → session-live-adjust", expected_observation: "非新建课时；新建意图转 generate-session-plan", role_scope_id: "COACH", source_doc: "PI-咨询技能.md", source_section: "F1", priority_id: "P1" }),
  caseRow({ item_id: "PI-SKILL-004", dimension_id: "E", category_major_id: "E_SKILL", category_minor_id: "E_SKILL_RT", sub_class: "咨询路由", detail_summary: "通用知识 → general-fitness-knowledge", expected_observation: "text；不进写库流程", role_scope_id: "COACH", source_doc: "PI-咨询技能.md", source_section: "F1", priority_id: "P1" }),
  caseRow({ item_id: "PI-SKILL-005", dimension_id: "E", category_major_id: "E_SKILL", category_minor_id: "E_SKILL_RT", sub_class: "咨询路由", detail_summary: "营养原则 → nutrition-weight", expected_observation: "原则性建议；非处方", role_scope_id: "ALL", source_doc: "PI-咨询技能.md", source_section: "F1", priority_id: "P1" }),
  caseRow({ item_id: "PI-SKILL-006", dimension_id: "E", category_major_id: "E_SKILL", category_minor_id: "E_SKILL_RT", sub_class: "咨询路由", detail_summary: "wiki-knowledge 禁写 raw", expected_observation: "可检索/读页；禁止 write raw", role_scope_id: "COACH", source_doc: "PI-咨询技能.md", source_section: "F2", code_reference: ".pi/workspaces-templates/coach/.pi/skills/wiki-knowledge/SKILL.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-SKILL-007", dimension_id: "E", category_major_id: "E_RISK", category_minor_id: "E_RISK_LIST", sub_class: "高风险", detail_summary: "问答误判为正式生成", expected_observation: "保持 text；不进 plan_form", role_scope_id: "COACH", source_doc: "PI-咨询技能.md", source_section: "F3", is_risk_flag: true }),
  caseRow({ item_id: "PI-SKILL-008", dimension_id: "E", category_major_id: "E_RISK", category_minor_id: "E_RISK_LIST", sub_class: "高风险", detail_summary: "A/B 会员上下文串用", expected_observation: "窗口隔离；不引用另一会员档案", role_scope_id: "COACH", source_doc: "PI-咨询技能.md", source_section: "F3", is_risk_flag: true }),

  // G · 记忆 / 工具 / 思考
  caseRow({ item_id: "PI-MEM-001", dimension_id: "E", category_major_id: "E3", category_minor_id: "E3_MEM", sub_class: "记忆路径", detail_summary: "记忆唯一路径 memory_ops", expected_observation: "emit 附 memory_ops；禁当轮 write MEMORY.md", role_scope_id: "ALL", source_doc: "PI-记忆工具思考.md", source_section: "G1", code_reference: ".pi/workspaces-templates/coach/.pi/skills/memory-persist/SKILL.md", is_risk_flag: true }),
  caseRow({ item_id: "PI-MEM-002", dimension_id: "E", category_major_id: "E3", category_minor_id: "E3_MEM", sub_class: "记忆路径", detail_summary: "会员说「记住」偏好", expected_observation: "可附 memory_ops；不写业务档案表", role_scope_id: "MEMBER", source_doc: "PI-记忆工具思考.md", source_section: "G1", priority_id: "P1" }),
  caseRow({ item_id: "PI-MEM-003", dimension_id: "E", category_major_id: "E3", category_minor_id: "E3_MEM", sub_class: "归档", detail_summary: "MEMORY 超限切分归档", expected_observation: "字节/单元切分行为符合单测", role_scope_id: "ALL", source_doc: "PI-记忆工具思考.md", source_section: "G1", code_reference: ".pi/src/pi/tests/memory-limits-archive.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- memory-limits", priority_id: "P1", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-TOOL-001", dimension_id: "E", category_major_id: "E2", category_minor_id: "E2_TOOL", sub_class: "教练工具", detail_summary: "教练工具白名单", expected_observation: "含 lookup/check_*；不含 assign_member", role_scope_id: "COACH", source_doc: "PI-记忆工具思考.md", source_section: "G2", code_reference: ".pi/src/pi/tools/fitnessTools.ts", priority_id: "P1" }),
  caseRow({ item_id: "PI-TOOL-002", dimension_id: "E", category_major_id: "E2", category_minor_id: "E2_TOOL", sub_class: "知识工具", detail_summary: "三端 knowledge 工具只读", expected_observation: "search_knowledge/read_wiki_page/list_raw/read_raw 可用且不写 raw", role_scope_id: "ALL", source_doc: "PI-记忆工具思考.md", source_section: "G2", priority_id: "P1" }),
  caseRow({ item_id: "PI-THINK-001", dimension_id: "E", category_major_id: "E5", category_minor_id: "E5_SEC", sub_class: "思考脱敏", detail_summary: "思考禁 skill 名/message_type", expected_observation: "thinking 脱敏过滤内部标识", role_scope_id: "ALL", source_doc: "PI-记忆工具思考.md", source_section: "G3", code_reference: ".pi/src/pi/tests/thinking-display.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- thinking-display", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT", is_risk_flag: true }),
  caseRow({ item_id: "PI-THINK-002", dimension_id: "E", category_major_id: "E5", category_minor_id: "E5_SEC", sub_class: "思考脱敏", detail_summary: "思考禁 user_id/cls_/文件名泄露", expected_observation: "数字主键与内部路径不出现在可见思考", role_scope_id: "ALL", source_doc: "PI-记忆工具思考.md", source_section: "G3", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- thinking-display", code_reference: ".pi/src/pi/tests/thinking-display.test.ts", priority_id: "P1" }),
  caseRow({ item_id: "PI-THINK-003", dimension_id: "E", category_major_id: "E5", category_minor_id: "E5_SEC", sub_class: "思考中文", detail_summary: "思考步骤全程中文", expected_observation: "禁止英文整段步骤清单", role_scope_id: "ALL", source_doc: "PI-记忆工具思考.md", source_section: "G3", priority_id: "P1" }),

  // H · HTTP / 静态
  caseRow({ item_id: "PI-HTTP-001", dimension_id: "A", category_major_id: "A3", category_minor_id: "A3_HTTP", sub_class: "turn", detail_summary: "三端 pipeline turn 入口", expected_observation: "coach/member/manager-turn 可接受合法请求", endpoint_path: "/v1/agent/pipeline/turn", http_method: "POST", role_scope_id: "ALL", source_doc: "PI-HTTP与静态守卫.md", source_section: "H1", code_reference: ".pi/docs/integration.md", priority_id: "P1" }),
  caseRow({ item_id: "PI-HTTP-002", dimension_id: "A", category_major_id: "A3", category_minor_id: "A3_HTTP", sub_class: "turn", detail_summary: "scene_code 错配 400", expected_observation: "HTTP 400", endpoint_path: "/v1/agent/pipeline/turn", http_method: "POST", http_status_expected: 400, role_scope_id: "ALL", source_doc: "PI-HTTP与静态守卫.md", source_section: "H1" }),
  caseRow({ item_id: "PI-HTTP-003", dimension_id: "A", category_major_id: "A3", category_minor_id: "A3_HTTP", sub_class: "abort", detail_summary: "turns abort", expected_observation: "可中止在途 turn", endpoint_path: "/v1/agent/turns/abort", http_method: "POST", role_scope_id: "ALL", source_doc: "PI-HTTP与静态守卫.md", source_section: "H1", priority_id: "P1" }),
  caseRow({ item_id: "PI-HTTP-004", dimension_id: "A", category_major_id: "A3", category_minor_id: "A3_HTTP", sub_class: "workspace", detail_summary: "coach-member / member-coach 切换", expected_observation: "工作区绑定接口成功", endpoint_path: "/v1/agent/workspace/coach-member", http_method: "POST", role_scope_id: "ALL", source_doc: "PI-HTTP与静态守卫.md", source_section: "H1", priority_id: "P1" }),
  caseRow({ item_id: "PI-HTTP-005", dimension_id: "A", category_major_id: "A3", category_minor_id: "A3_HTTP", sub_class: "探针", detail_summary: "health/ready 放行", expected_observation: "无 Key 亦可访问 /health /ready", endpoint_path: "/health", http_method: "GET", role_scope_id: "ALL", source_doc: "PI-HTTP与静态守卫.md", source_section: "H1", priority_id: "P1" }),
  caseRow({ item_id: "PI-STATIC-001", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "工程守卫", detail_summary: "角色目录 import 隔离", expected_observation: "role-isolation-guard 通过", role_scope_id: "ALL", source_doc: "PI-HTTP与静态守卫.md", source_section: "H2", code_reference: ".pi/src/harness/tests/role-isolation-guard.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- role-isolation", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-STATIC-002", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "工程守卫", detail_summary: "member/manager kernel 对称", expected_observation: "role-kernel-parity 通过", role_scope_id: "ALL", source_doc: "PI-HTTP与静态守卫.md", source_section: "H2", code_reference: ".pi/src/harness/tests/role-kernel-parity.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- role-kernel-parity", priority_id: "P1", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-STATIC-003", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "工程守卫", detail_summary: "text-role 幂等 replay", expected_observation: "replay 不重写 log", role_scope_id: "ALL", source_doc: "PI-HTTP与静态守卫.md", source_section: "H2", code_reference: ".pi/src/harness/tests/text-role-turn-pipeline-replay.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- text-role-turn-pipeline-replay", priority_id: "P1", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
  caseRow({ item_id: "PI-STATIC-004", dimension_id: "A", category_major_id: "A1", category_minor_id: "A1_UNIT", sub_class: "契约套件", detail_summary: "harness outbox-contract + text-role-payload", expected_observation: "harness.test 套件通过", role_scope_id: "ALL", source_doc: "PI-HTTP与静态守卫.md", source_section: "H2", code_reference: ".pi/src/harness/tests/harness.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- harness", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-02-CONTRACT" }),
  caseRow({ item_id: "PI-WIKI-001", dimension_id: "E", category_major_id: "E2", category_minor_id: "E2_TOOL", sub_class: "wiki", detail_summary: "wiki 检索 BM25/hybrid", expected_observation: "wiki-search / embedding 单测通过", role_scope_id: "ALL", source_doc: "PI-记忆工具思考.md", source_section: "G2", code_reference: ".pi/src/pi/tests/wiki-search.test.ts", automation_status_id: "AUTO_EXISTING", automation_command: "cd fitness-agent/.pi && npm test -- wiki", priority_id: "P1", scheme_primary_id: "TS-01-DET", validation_primary_id: "VS-01-EXACT" }),
];

/** 将历史 A/C/E 大类编码规范到通用 T1–T12（直接替换，勿再写回业务大类） */
function mapToGenericTaxonomy(row) {
  const id = row.item_id;
  const oldMinor = row.category_minor_id;
  let major = "T1";
  let minor = "T1_SCHEMA";
  if (id.startsWith("PI-EMIT-")) { major = "T1"; minor = "T1_SCHEMA"; }
  else if (id.startsWith("PI-STATIC-")) { major = "T1"; minor = "T1_STATIC"; }
  else if (id.startsWith("PI-SCENE-")) { major = "T2"; minor = "T2_ROLE"; }
  else if (id.startsWith("PI-MEMB-")) {
    if (oldMinor === "C2_PAYLOAD" || /载荷/.test(row.sub_class || "")) { major = "T2"; minor = "T2_PAYLOAD"; }
    else if (oldMinor === "C2_MED" || /医学/.test(row.sub_class || "")) { major = "T6"; minor = "T6_SAFETY"; }
    else { major = "T2"; minor = "T2_CAPABILITY"; }
  } else if (id.startsWith("PI-MGR-")) {
    if (oldMinor === "C3_PAYLOAD" || /载荷/.test(row.sub_class || "")) { major = "T2"; minor = "T2_PAYLOAD"; }
    else if (oldMinor === "C3_RISK" || /风险/.test(row.sub_class || "")) { major = "T6"; minor = "T6_BLOCK"; }
    else if (oldMinor === "C3_PERM" || /边界/.test(row.sub_class || "")) { major = "T2"; minor = "T2_ROLE"; }
    else { major = "T2"; minor = "T2_CAPABILITY"; }
  } else if ([ "PI-MACRO-007", "PI-MACRO-008", "PI-MACRO-009" ].includes(id)) { major = "T3"; minor = "T3_STATE"; }
  else if (id.startsWith("PI-DEL-") || id.startsWith("PI-ARCH-") || id === "PI-FOLLOW-002") { major = "T3"; minor = "T3_CONFIRM"; }
  else if (id.startsWith("PI-MACRO-") || id.startsWith("PI-SESS-") || id.startsWith("PI-SUM-") || id.startsWith("PI-ENTRY-") || id.startsWith("PI-FOLLOW-")) { major = "T3"; minor = "T3_FLOW"; }
  else if (id.startsWith("PI-SKILL-007") || id.startsWith("PI-SKILL-008")) { major = "T6"; minor = "T6_BLOCK"; }
  else if (id.startsWith("PI-SKILL-")) { major = "T4"; minor = "T4_ROUTE"; }
  else if (id.startsWith("PI-SAFE-")) { major = "T6"; minor = "T6_SAFETY"; }
  else if (id.startsWith("PI-THINK-")) { major = "T6"; minor = "T6_PRIVACY"; }
  else if (id.startsWith("PI-TOOL-")) { major = "T5"; minor = "T5_TOOL"; }
  else if (id.startsWith("PI-MEM-")) { major = "T5"; minor = "T5_MEMORY"; }
  else if (id.startsWith("PI-WIKI-")) { major = "T5"; minor = "T5_RETRIEVAL"; }
  else if (id.startsWith("PI-HTTP-")) { major = "T7"; minor = "T7_HTTP"; }
  const dim = { T1: "S", T2: "S", T7: "S", T3: "B", T4: "B", T5: "B", T6: "Q", T10: "Q", T12: "Q", T8: "R", T9: "R", T11: "R" }[major] || "S";
  return {
    ...row,
    dimension_id: dim,
    category_major_id: major,
    category_minor_id: minor,
    tags: [ "PI", major ],
  };
}

for (let i = 0; i < CASES.length; i++) CASES[i] = mapToGenericTaxonomy(CASES[i]);

console.log(`Catalog size: ${CASES.length}`);

// ─── helpers: rewrite table init data ─────────────────────────────
function rewriteItemDetail(targetDir) {
  const dataFile = join(targetDir, "data.json");
  const initFile = join(targetDir, "init.sql");
  const docFile = join(targetDir, "表说明.md");
  writeFileSync(dataFile, `${JSON.stringify(CASES, null, 2)}\n`);
  const raw = readFileSync(initFile, "utf8");
  const ddlLines = raw.split(/\r?\n/).filter((l) => !/^\s*INSERT\s+INTO/i.test(l) && !/^\s*--\s*数据导入/.test(l));
  while (ddlLines.length && !ddlLines[ddlLines.length - 1].trim()) ddlLines.pop();
  const inserts = CASES.map(buildInsert);
  writeFileSync(initFile, `${ddlLines.join("\n")}\n\n-- 数据导入（${CASES.length} 条 · 仅 .pi）\n${inserts.join("\n")}\n`);
  writeFileSync(
    docFile,
    `# test_item_detail · 测试核心细节主表（仅 .pi）\n\n> 共 **${CASES.length}** 条。真源：\`fitness-agent/.pi\`（workspaces-templates + src 契约/单测）。\n\n旧六站/套壳/RDS/压测用例已移除；重置本表即注入本文件。\n\n## 字段\n\n见 DDL \`init.sql\`。\n`,
  );
  console.log(`wrote ${targetDir} → ${CASES.length}`);
}

function emptyLinkTable(tableDir, columnsSql, emptyNote) {
  const dataFile = join(tableDir, "data.json");
  const initFile = join(tableDir, "init.sql");
  writeFileSync(dataFile, "[]\n");
  const raw = readFileSync(initFile, "utf8");
  const ddl = raw.split("\n-- 数据导入")[0];
  writeFileSync(initFile, `${ddl}\n-- 数据导入（0 条 · ${emptyNote}）\n`);
  console.log(`emptied ${tableDir}`);
}

function updateMajorCounts(majorDataFile, majorInitFile) {
  const majors = JSON.parse(readFileSync(majorDataFile, "utf8"));
  const counts = {};
  for (const r of CASES) counts[r.category_major_id] = (counts[r.category_major_id] || 0) + 1;
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

function writePrefixScheme() {
  const prefixes = [
    { prefix: "PI-SCENE-", scheme: "TS-01-DET", validation: "VS-01-EXACT", note: "scene_code 围栏" },
    { prefix: "PI-EMIT-", scheme: "TS-01-DET", validation: "VS-02-CONTRACT", note: "emit/outbox 契约" },
    { prefix: "PI-MACRO-", scheme: "TS-05-CHAIN", validation: "VS-04-CHAIN-OK", note: "宏观计划工作流" },
    { prefix: "PI-SESS-", scheme: "TS-05-CHAIN", validation: "VS-04-CHAIN-OK", note: "单节课工作流" },
    { prefix: "PI-SUM-", scheme: "TS-02-BND", validation: "VS-02-CONTRACT", note: "课后总结" },
    { prefix: "PI-DEL-", scheme: "TS-05-CHAIN", validation: "VS-04-CHAIN-OK", note: "删除两轮" },
    { prefix: "PI-FOLLOW-", scheme: "TS-04-SET", validation: "VS-03-ZERO", note: "好的兑现/确认边界" },
    { prefix: "PI-ENTRY-", scheme: "TS-04-SET", validation: "VS-07-RATE-H", note: "教练入口" },
    { prefix: "PI-SAFE-", scheme: "TS-07-NEG", validation: "VS-09-BLOCK-H", note: "安全/医学/评估" },
    { prefix: "PI-ARCH-", scheme: "TS-02-BND", validation: "VS-02-CONTRACT", note: "档案确认" },
    { prefix: "PI-MEMB-", scheme: "TS-02-BND", validation: "VS-02-CONTRACT", note: "会员端边界" },
    { prefix: "PI-MGR-", scheme: "TS-02-BND", validation: "VS-02-CONTRACT", note: "店长端" },
    { prefix: "PI-SKILL-", scheme: "TS-04-SET", validation: "VS-07-RATE-H", note: "咨询 skill" },
    { prefix: "PI-MEM-", scheme: "TS-01-DET", validation: "VS-02-CONTRACT", note: "memory_ops" },
    { prefix: "PI-TOOL-", scheme: "TS-01-DET", validation: "VS-02-CONTRACT", note: "工具白名单" },
    { prefix: "PI-THINK-", scheme: "TS-01-DET", validation: "VS-01-EXACT", note: "思考脱敏" },
    { prefix: "PI-HTTP-", scheme: "TS-01-DET", validation: "VS-01-EXACT", note: ".pi HTTP" },
    { prefix: "PI-STATIC-", scheme: "TS-01-DET", validation: "VS-01-EXACT", note: "静态守卫" },
    { prefix: "PI-WIKI-", scheme: "TS-01-DET", validation: "VS-01-EXACT", note: "wiki 检索" },
  ];
  const rows = prefixes.map((p, i) => ({
    mapping_id: `MAP${String(i + 1).padStart(4, "0")}`,
    item_prefix: p.prefix,
    scheme_primary_id: p.scheme,
    scheme_secondary_id: null,
    validation_primary_id: p.validation,
    validation_secondary_id: null,
    sample_execution_note: p.note,
    mapping_source: "PI-方案映射.md",
    project_code: "fitness-agent",
  }));
  const dir = join(testgenRoot, "database/tables/test_item_prefix_scheme");
  writeFileSync(join(dir, "data.json"), `${JSON.stringify(rows, null, 2)}\n`);
  const rawInit = readFileSync(join(dir, "init.sql"), "utf8");
  const ddlLines = rawInit.split(/\r?\n/).filter((l) => !/^\s*INSERT\s+INTO/i.test(l) && !/^\s*--\s*数据导入/.test(l));
  while (ddlLines.length && !ddlLines[ddlLines.length - 1].trim()) ddlLines.pop();
  const inserts = rows.map((p) =>
    `INSERT INTO test_item_prefix_scheme (mapping_id, item_prefix, scheme_primary_id, scheme_secondary_id, validation_primary_id, validation_secondary_id, sample_execution_note, mapping_source) VALUES ('${p.mapping_id}', '${p.item_prefix}', '${p.scheme_primary_id}', NULL, '${p.validation_primary_id}', NULL, '${p.sample_execution_note}', '${p.mapping_source}') ON CONFLICT (mapping_id) DO NOTHING;`,
  );
  writeFileSync(join(dir, "init.sql"), `${ddlLines.join("\n")}\n\n-- 数据导入（${rows.length} 条 · 仅 .pi）\n${inserts.join("\n")}\n`);
  return rows;
}

function mdTable(rows, headers) {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const r of rows) lines.push(`| ${headers.map((h) => r[h] || "").join(" | ")} |`);
  return lines.join("\n");
}

function writeCoreDocs(targetDetailDir, mappingDir, prefixRows) {
  mkdirSync(targetDetailDir, { recursive: true });
  const byDoc = {};
  for (const c of CASES) {
    (byDoc[c.source_doc] ||= []).push(c);
  }

  const readme = `# 测试项核心细节（仅 .pi）

> **版本**：2026-07-29 · **条目**：${CASES.length} · **真源**：\`fitness-agent/.pi\`
>
> 已废弃旧 A–H 六站/套壳/RDS/压测用例。本目录只描述 Agent（Pi）行为与契约。

| 文件 | 内容 |
|------|------|
| [PI-场景与角色.md](./PI-场景与角色.md) | scene_code / 角色围栏 |
| [PI-emit契约.md](./PI-emit契约.md) | emit_outbox / 一轮一 UI |
| [PI-教练工作流.md](./PI-教练工作流.md) | 计划/课时/总结/删除/安全 |
| [PI-会员与店长.md](./PI-会员与店长.md) | member / manager 边界 |
| [PI-咨询技能.md](./PI-咨询技能.md) | 咨询 skill 与高风险 |
| [PI-记忆工具思考.md](./PI-记忆工具思考.md) | memory / tools / thinking |
| [PI-HTTP与静态守卫.md](./PI-HTTP与静态守卫.md) | .pi HTTP + 工程单测 |

自动化优先：\`cd fitness-agent/.pi && npm test\`。
`;
  writeFileSync(join(targetDetailDir, "README.md"), readme);

  for (const [doc, items] of Object.entries(byDoc)) {
    const sectionMap = {};
    for (const it of items) {
      (sectionMap[it.source_section] ||= []).push(it);
    }
    let body = `# ${doc.replace(".md", "")}\n\n> 真源：\`fitness-agent/.pi\`\n\n`;
    for (const [sec, list] of Object.entries(sectionMap)) {
      body += `## ${sec}\n\n`;
      body += mdTable(
        list.map((x) => ({
          "测试项 ID": x.item_id,
          子类: x.sub_class,
          测试核心细节: x.detail_summary,
          "预期 / 观测点": x.expected_observation,
          优先级: x.priority_id,
          自动化: x.automation_status_id === "AUTO_EXISTING" ? "已有 .pi 单测" : "待建",
        })),
        ["测试项 ID", "子类", "测试核心细节", "预期 / 观测点", "优先级", "自动化"],
      );
      body += "\n\n";
    }
    writeFileSync(join(targetDetailDir, doc), body);
  }

  for (const f of readdirSync(targetDetailDir)) {
    if (!f.endsWith(".md")) continue;
    if (f === "README.md" || f.startsWith("PI-")) continue;
    unlinkSync(join(targetDetailDir, f));
    console.log("removed obsolete", f);
  }

  mkdirSync(mappingDir, { recursive: true });
  const mapBody = `# PI · 方案映射（仅 .pi）

> 核心细节：\`测试项核心细节/PI-*.md\`

| 测试项前缀/ID | 主方案 TS | 主验证 VS | 辅助方案 | 样本/执行说明 |
|---------------|-----------|-----------|----------|---------------|
${prefixRows.map((p) => `| **${p.item_prefix}*** | ${p.scheme_primary_id} | ${p.validation_primary_id} | — | ${p.sample_execution_note} |`).join("\n")}
`;
  writeFileSync(join(mappingDir, "PI-方案映射.md"), mapBody);
  writeFileSync(join(mappingDir, "README.md"), `# 测试方案映射（仅 .pi）\n\n见 [PI-方案映射.md](./PI-方案映射.md)。旧 A–H 映射文件已废弃。\n`);
  for (const f of readdirSync(mappingDir)) {
    if (f === "README.md" || f === "PI-方案映射.md" || f.startsWith("00-")) continue;
    if (f.endsWith("-方案映射.md") || f.endsWith("方案映射.md")) {
      try {
        unlinkSync(join(mappingDir, f));
        console.log("removed map", f);
      } catch {
        /* */
      }
    }
  }
}

function writeNewCasesPointer() {
  const path = join(docsRoot, "新用例.md");
  writeFileSync(
    path,
    `# 用例重建说明（2026-07-29）

> **旧 TSV「新用例」与旧 A–H 全量用例已废弃。**
>
> 当前唯一测试用例真源：\`fitness-agent/.pi\` → 生成结果见：
> - \`测试项核心细节/PI-*.md\`
> - \`数据库详细表/test_item_detail/\`
> - \`admin-management-station/.../testgen-sub/database/tables/test_item_detail/\`
>
> 重置平台库：
> \`\`\`bash
> cd admin-management-station/project-sub/testgen-sub/deploy
> ams-testgen db:reset test_item_detail test_item_prefix_scheme test_item_risk_link test_item_prd_ref_link test_item_prd_goal_link test_item_arch_ref_link test_category_major
> \`\`\`
`,
  );
}

// ─── main ─────────────────────────────────────────────────────────
const tgItemDir = join(testgenRoot, "database/tables/test_item_detail");
const upItemDir = join(docsRoot, "数据库详细表/test_item_detail");

rewriteItemDetail(tgItemDir);
rewriteItemDetail(upItemDir);

emptyLinkTable(join(testgenRoot, "database/tables/test_item_risk_link"), null, "旧风险关联随旧用例清除");
emptyLinkTable(join(testgenRoot, "database/tables/test_item_prd_ref_link"), null, "旧 PRD 关联清除");
emptyLinkTable(join(testgenRoot, "database/tables/test_item_prd_goal_link"), null, "旧目标关联清除");
emptyLinkTable(join(testgenRoot, "database/tables/test_item_arch_ref_link"), null, "旧架构关联清除");

// upstream links if exist
for (const name of ["test_item_risk_link", "test_item_prd_ref_link", "test_item_prd_goal_link", "test_item_arch_ref_link"]) {
  const d = join(docsRoot, "数据库详细表", name);
  try {
    emptyLinkTable(d, null, "随 .pi 重建清空");
  } catch (e) {
    console.warn("skip", name, e.message);
  }
}

updateMajorCounts(
  join(testgenRoot, "database/tables/test_category_major/data.json"),
  join(testgenRoot, "database/tables/test_category_major/init.sql"),
);

const prefixRows = writePrefixScheme();
writeCoreDocs(join(docsRoot, "测试项核心细节"), join(docsRoot, "测试方案核心细节与方案关系"), prefixRows);
writeCoreDocs(join(tgDocs, "测试项核心细节"), join(tgDocs, "测试方案核心细节与方案关系"), prefixRows);
writeNewCasesPointer();

writeFileSync(
  join(docsRoot, "数据库详细表/README.md"),
  `# 数据库详细表（仅 .pi 用例）\n\n测试项：**${CASES.length}** 条（\`test_item_detail\`）。\n\n由 \`testgen-sub/test-project/fitness-agent/scripts/generate-pi-only-cases.mjs\` 生成。\n`,
);

console.log("\nDONE. Reset with:");
console.log("  ams-testgen db:reset test_item_detail test_item_prefix_scheme test_item_risk_link test_item_prd_ref_link test_item_prd_goal_link test_item_arch_ref_link test_category_major");
