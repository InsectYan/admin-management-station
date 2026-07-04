#!/usr/bin/env node
/**
 * 将 fitness-agent 已落地单测回写到 test_item_detail/data.json 与 init.sql。
 * 文档：test-project/fitness-agent/数据库自动化同步.md
 * Usage: node test-project/fitness-agent/scripts/sync-automation-status.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataFile = join(here, "../../../database/tables/test_item_detail/data.json");
const initSqlFile = join(here, "../../../database/tables/test_item_detail/init.sql");

/** init.sql INSERT 列序（与 seed 一致，不含 enrich 展示字段） */
const INSERT_COLUMNS = [
  "item_id",
  "dimension_id",
  "category_major_id",
  "category_minor_id",
  "sub_class",
  "item_name",
  "detail_summary",
  "expected_observation",
  "test_input_example",
  "preconditions",
  "test_steps",
  "assertion_points",
  "priority_id",
  "prd_ref_id",
  "prd_ref_ids",
  "arch_ref_id",
  "arch_ref_ids",
  "prd_goal_ids",
  "automation_status_id",
  "automation_entry_id",
  "automation_command",
  "config_env",
  "config_env_id",
  "station_id",
  "role_scope_id",
  "endpoint_path",
  "http_method",
  "http_status_expected",
  "scheme_primary_id",
  "scheme_secondary_id",
  "validation_primary_id",
  "validation_secondary_id",
  "sample_execution_note",
  "scheme_mapping_source",
  "is_risk_flag",
  "is_observability_audit",
  "is_p0_blocker",
  "failure_symptom",
  "code_reference",
  "tags",
  "notes",
  "source_doc",
  "source_section",
  "is_active",
];

/** item_id → 自动化覆盖更新（新增单测时在此追加） */
const PATCH = {
  // ── s02 门禁 ──
  "B2-CIRCUIT-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- db-circuit",
    code_reference: "server/src/stations/s02-gate/tests/db-circuit.test.ts",
    test_steps: ["运行 db-circuit 站级自测", "断言：503 + circuit_breaker"],
  },
  "B2-DUP-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
  },
  "B2-EMPTY-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    test_steps: ["构造空白 message", "断言：400"],
  },
  "B2-INFLIGHT-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    test_steps: ["pending 在途时第二条 submit", "断言：429"],
  },
  "B2-RATE-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    test_steps: ["连续 submit 超 actor 限流", "断言：第 11 条 429"],
  },
  "B2-OWN-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard-ext",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard-ext.test.ts",
    test_steps: ["运行 turn-submit-guard-ext", "断言：非己 session 403"],
  },
  "B2-LEN-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard-ext",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard-ext.test.ts",
    test_steps: ["构造超 messageMaxLength 消息", "断言：400"],
  },
  "B2-KEY-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- s02-key",
    code_reference: "server/src/stations/s02-gate/tests/internal-api-key.test.ts",
  },
  "B3-CANCEL-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    test_steps: ["cancel pending turn", "断言：cancelled 后可再 submit"],
  },
  "D2-SUB-003": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    test_steps: ["缺 message 空串", "断言：400"],
  },
  "D2-SUB-004": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    test_steps: ["在途第二条 submit", "断言：429"],
  },
  "D2-SUB-005": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-queue-policy",
    code_reference: "server/src/stations/s02-gate/tests/turn-queue-policy.test.ts",
    expected_observation: "503 queue reject 或 queue_meta warn",
  },
  "D2-SUB-006": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- s02-key",
    code_reference: "server/src/stations/s02-gate/tests/internal-api-key.test.ts",
  },
  "D2-SUB-007": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    test_steps: ["非 session 所属 coach submit", "断言：403"],
  },
  "A2-S02-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- s02",
    code_reference:
      "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts, server/src/stations/s02-gate/tests/turn-submit-guard-ext.test.ts",
  },
  "A2-S02-002": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- s02",
    code_reference:
      "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts, server/src/stations/s02-gate/tests/turn-submit-guard-ext.test.ts",
  },
  "A2-S02-003": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- s02",
    code_reference:
      "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts, server/src/stations/s02-gate/tests/turn-submit-guard-ext.test.ts",
  },
  "A2-S02-004": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- s02",
    code_reference:
      "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts, server/src/stations/s02-gate/tests/turn-submit-guard-ext.test.ts",
  },

  // ── s03 队列 ──
  "B3-ENQ-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03",
    automation_command: "cd server && npm run test:stations -- s03",
    code_reference: "server/src/stations/s03-queue/tests/turn-job-store.test.ts",
    test_steps: ["enqueueTurnJob 合法 submit", "断言：pending + created=true"],
  },
  "B3-CLAIM-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03",
    automation_command: "cd server && npm run test:stations -- turn-job-lifecycle",
    code_reference: "server/src/stations/s03-queue/tests/turn-job-lifecycle.test.ts",
  },
  "B3-STALE-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03",
    automation_command: "cd server && npm run test:stations -- turn-job-lifecycle",
    code_reference: "server/src/stations/s03-queue/tests/turn-job-lifecycle.test.ts",
  },
  "B3-RETRY-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03",
    automation_command: "cd server && npm run test:stations -- s03-retry",
    code_reference: "server/src/stations/s03-queue/tests/turn-job-retry.test.ts",
  },
  "D1-SESSION-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03",
    automation_command: "cd server && npm run test:stations -- portal-chat-session",
    code_reference: "server/src/stations/s03-queue/tests/portal-chat-session.test.ts",
    test_steps: ["运行 portal-chat-session", "断言：member/manager session upsert"],
  },
  "D1-CANCEL-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-submit-guard",
    code_reference: "server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    test_steps: ["cancel pending turn", "断言：cancelled"],
  },
  "D1-POLL-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S06",
    automation_command: "cd server && npm run test:stations -- turns-poll",
    code_reference: "server/src/stations/s03-queue/tests/turns-router-poll.test.ts",
    test_steps: ["GET /turns/:id 轮询", "断言：stream_events + result_json"],
  },
  "D4-FLD-003": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03",
    automation_command: "cd server && npm run test:stations -- s03",
    code_reference: "server/src/stations/s03-queue/tests/turn-job-store.test.ts",
    test_steps: ["相同 client_turn_id 二次入队", "断言：created=false 同 turn_id"],
  },
  "H2-FLD-016": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03",
    automation_command: "cd server && npm run test:stations -- turn-idempotency-poll",
    code_reference:
      "server/src/stations/s03-queue/tests/turn-idempotency-poll.test.ts, server/src/stations/s03-queue/tests/turn-job-store.test.ts",
    test_steps: ["幂等 client_turn_id 命中缓存", "断言：poll 返回已有 response"],
  },
  "A2-S03-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03",
    automation_command: "cd server && npm run test:stations -- s03",
    code_reference:
      "server/src/stations/s03-queue/tests/turn-job-store.test.ts, server/src/stations/s03-queue/tests/turn-job-lifecycle.test.ts",
  },

  // ── s04 Pipeline ──
  "B4-PREP-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S04_BFF",
    automation_command: "cd server && npm run test:stations -- s04-bff",
    code_reference: "server/src/stations/s04-pipeline/tests/suites/bff-pipeline.suite.ts",
  },
  "B4-PREP-002": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S04_BFF",
    automation_command: "cd server && npm run test:stations -- s04-bff",
    code_reference: "server/src/stations/s04-pipeline/tests/suites/bff-pipeline.suite.ts",
  },
  "B4-PERSIST-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S04_BFF",
    automation_command: "cd server && npm run test:stations -- s04-persist",
    code_reference: "server/src/stations/s04-pipeline/tests/suites/persist-pipeline.suite.ts",
    test_steps: [
      "P1 text · P2 plan_form · P3 training_plan · P4 session_plan",
      "P5 require_form · P6 session_summary · P7 disambiguation",
      "P8 member_switch · P9 intent_clarification",
    ],
  },
  "B5-CONTRACT-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S05",
    automation_command: "cd server && npm run test:stations -- s04-outbox",
    code_reference: "server/src/stations/s04-pipeline/tests/suites/outbox-contract.suite.ts",
  },
  "G5-UI-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S04_BFF",
    automation_command: "cd server && npm run test:stations -- form-gates",
    code_reference: "server/src/stations/s04-pipeline/tests/form-gates-normalize.test.ts",
    test_steps: ["normalizeRequireFormData plan_form", "断言：模板字段规范化"],
  },
  "G5-UI-002": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S04_BFF",
    automation_command: "cd server && npm run test:stations -- form-gates",
    code_reference: "server/src/stations/s04-pipeline/tests/form-gates-normalize.test.ts",
    test_steps: ["require_form 课时前置", "断言：pickSummaryBody / form gate"],
  },
  "D5-EVT-002": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S04_BFF",
    automation_command: "cd server && npm run test:stations -- turn-job-stream",
    code_reference: "server/src/stations/s04-pipeline/tests/turn-job-stream.test.ts",
    test_steps: ["thinking 节流 append", "断言：delta 合并与 done 帧"],
  },
  "C2-UX-002": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S03",
    automation_command: "cd server && npm run test:stations -- turn-idempotency-poll",
    code_reference:
      "server/src/stations/s03-queue/tests/turn-idempotency-poll.test.ts, server/src/stations/s04-pipeline/tests/portal-turn-pipeline-replay.test.ts, server/src/stations/s02-gate/tests/turn-submit-guard.test.ts",
    test_steps: ["同 client_turn_id 重复 submit", "断言：缓存 replay / 429 去重"],
  },
  "A1-OUTBOX-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S05",
    automation_command: "cd server && npm run test:stations -- s04-outbox",
    code_reference: "server/src/stations/s04-pipeline/tests/suites/outbox-contract.suite.ts",
  },
  "A1-OUTBOX-002": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S05",
    automation_command: "cd server && npm run test:stations -- s04-outbox",
    code_reference: "server/src/stations/s04-pipeline/tests/suites/outbox-contract.suite.ts",
  },
  "C2-PAYLOAD-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S04_BFF",
    automation_command: "cd server && npm run test:stations -- s04-portal",
    code_reference: "server/src/stations/s04-pipeline/tests/suites/portal-payload.suite.ts",
  },
  "C2-PAYLOAD-002": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S04_BFF",
    automation_command: "cd server && npm run test:stations -- s04-portal",
    code_reference: "server/src/stations/s04-pipeline/tests/suites/portal-payload.suite.ts",
  },
  "C2-PAYLOAD-003": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S04_BFF",
    automation_command: "cd server && npm run test:stations -- s04-portal",
    code_reference: "server/src/stations/s04-pipeline/tests/suites/portal-payload.suite.ts",
  },

  // ── s05 Pi 契约 ──
  "A1-MEMORY-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S05",
    automation_command: "cd server && npm run test:stations -- s05",
    code_reference:
      "server/src/stations/s05-pi/tests/s05-pi.test.ts, server/src/stations/s05-pi/tests/memory-compress-guard.test.ts",
  },
  "C2-UX-003": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S05",
    automation_command: "cd server && npm run test:stations -- coach-fallback",
    code_reference: "server/src/stations/s05-pi/tests/coach-turn-fallback.test.ts",
    test_steps: ["429 / API key 无效 / 无 outbox", "断言：降级文案"],
  },

  // ── s06 回传 ──
  "B6-SSE-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S06",
    automation_command: "cd server && npm run test:stations -- sse-frame",
    code_reference: "server/src/stations/s06-stream/tests/sse-frame.test.ts",
  },
  "B6-TIMEOUT-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S06",
    automation_command: "cd server && npm run test:stations -- sse-timeout",
    code_reference: "server/src/stations/s06-stream/tests/turn-stream-timeout.test.ts",
    test_steps: ["processing turn 超 streamMaxWaitMs", "断言：SSE error Turn stream timeout"],
    expected_observation: "stream max wait 断流",
  },
  "B6-POLL-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S06",
    automation_command: "cd server && npm run test:stations -- turns-poll",
    code_reference: "server/src/stations/s03-queue/tests/turns-router-poll.test.ts",
    test_steps: ["GET /turns/:id?after_seq=N", "断言：stream_events + completed result_json"],
  },
  "B6-JOURNEY-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S06",
    automation_command: "cd server && npm run test:stations -- s06",
    code_reference: "server/src/stations/s06-stream/tests/turn-journey.test.ts",
  },
  "A2-S06-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S06",
    automation_command: "cd server && npm run test:stations -- s06",
    code_reference:
      "server/src/stations/s06-stream/tests/turn-journey.test.ts, server/src/stations/s06-stream/tests/sse-frame.test.ts",
  },

  // ── s01 前端 ──
  "B1-SSE-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S01",
    automation_command: "cd server && npm run test:stations -- agent-sse",
    code_reference:
      "frontend/tests/agent-sse.unit.ts, frontend/tests/agent-sse-stream.unit.ts",
    test_steps: ["运行 agent-sse / agent-sse-stream", "断言：SSE 事件解析与 queue hint"],
  },
  "B1-STREAM-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S01",
    automation_command: "cd server && npm run test:stations -- coach-turn-session",
    code_reference: "frontend/tests/coach-turn-session.unit.ts",
    test_steps: ["运行 coach-turn-session", "断言：切 session 不串流、abort 旧 SSE"],
  },
};

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

/** @param {Record<string, unknown>[]} rows */
function syncInitSql(rows, patchedIds) {
  const content = readFileSync(initSqlFile, "utf8");
  const rowById = new Map(rows.map((r) => [r.item_id, r]));
  let replaced = 0;
  const missing = [];

  const newLines = content.split("\n").map((line) => {
    if (!line.startsWith("INSERT INTO test_item_detail")) return line;
    const match = line.match(/VALUES \('([^']+)'/);
    if (!match) return line;
    const itemId = match[1];
    if (!patchedIds.has(itemId)) return line;
    const row = rowById.get(itemId);
    if (!row) {
      missing.push(itemId);
      return line;
    }
    const filtered = {};
    for (const col of INSERT_COLUMNS) filtered[col] = row[col] ?? null;
    replaced++;
    return buildInsertLine(filtered);
  });

  if (missing.length) {
    console.warn(`WARN: PATCH item_id 不在 data.json：${missing.join(", ")}`);
  }

  writeFileSync(initSqlFile, `${newLines.join("\n")}\n`, "utf8");
  return replaced;
}

/** @param {string} content */
function countInitAutoExisting(content) {
  let count = 0;
  for (const line of content.split("\n")) {
    if (!line.startsWith("INSERT INTO test_item_detail")) continue;
    if (line.includes("'AUTO_EXISTING'")) count++;
  }
  return count;
}

const patchedIds = new Set(Object.keys(PATCH));
const rows = JSON.parse(readFileSync(dataFile, "utf8"));
let touched = 0;
for (const row of rows) {
  const patch = PATCH[row.item_id];
  if (!patch) continue;
  Object.assign(row, patch);
  touched++;
}

writeFileSync(dataFile, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`Patched ${touched} rows in data.json`);

const initReplaced = syncInitSql(rows, patchedIds);
console.log(`Replaced ${initReplaced} INSERT lines in init.sql`);

const jsonExisting = rows.filter(
  (r) => r.is_active !== false && r.automation_status_id === "AUTO_EXISTING",
).length;
const initExisting = countInitAutoExisting(readFileSync(initSqlFile, "utf8"));
console.log(`AUTO_EXISTING: data.json=${jsonExisting}, init.sql=${initExisting}`);
if (jsonExisting !== initExisting) {
  console.warn(
    "WARN: data.json 与 init.sql 的 AUTO_EXISTING 计数不一致。"
      + " 若仍有漂移，请检查非 PATCH 行或运行 ams-testgen db:reset test_item_detail",
  );
} else {
  console.log("OK: data.json 与 init.sql AUTO_EXISTING 计数一致");
}

console.log("\n下一步注入 Postgres：");
console.log("  cd deploy && ams-testgen db:reset test_item_detail");
