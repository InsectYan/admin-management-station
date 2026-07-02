#!/usr/bin/env node
/**
 * 将 fitness-agent 已落地单测回写到 test_item_detail/data.json。
 * 文档：test-project/fitness-agent/数据库自动化同步.md
 * Usage: node test-project/fitness-agent/scripts/sync-automation-status.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataFile = join(here, "../../../database/tables/test_item_detail/data.json");

/** item_id → 自动化覆盖更新 */
const PATCH = {
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
  "D2-SUB-005": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- turn-queue-policy",
    code_reference: "server/src/stations/s02-gate/tests/turn-queue-policy.test.ts",
    expected_observation: "503 queue reject 或 queue_meta warn",
  },
  "B2-KEY-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- s02-key",
    code_reference: "server/src/stations/s02-gate/tests/internal-api-key.test.ts",
  },
  "D2-SUB-006": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S02",
    automation_command: "cd server && npm run test:stations -- s02-key",
    code_reference: "server/src/stations/s02-gate/tests/internal-api-key.test.ts",
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
  "B6-SSE-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S06",
    automation_command: "cd server && npm run test:stations -- sse-frame",
    code_reference: "server/src/stations/s06-stream/tests/sse-frame.test.ts",
  },
  "B1-SSE-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S01",
    automation_command: "cd server && npm run test:stations -- agent-sse",
    code_reference: "frontend/tests/agent-sse.unit.ts",
  },
  "B1-QUEUE-UX-001": {
    automation_status_id: "AUTO_EXISTING",
    automation_entry_id: "AUTO_S01",
    automation_command: "cd server && npm run test:stations -- agent-sse",
    code_reference: "frontend/tests/agent-sse.unit.ts",
  },
  "A1-OUTBOX-001": {
    automation_command: "cd server && npm run test:stations -- s04-outbox",
    code_reference: "server/src/stations/s04-pipeline/tests/suites/outbox-contract.suite.ts",
  },
  "A1-OUTBOX-002": {
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
};

const rows = JSON.parse(readFileSync(dataFile, "utf8"));
let touched = 0;
for (const row of rows) {
  const patch = PATCH[row.item_id];
  if (!patch) continue;
  Object.assign(row, patch);
  touched++;
}
writeFileSync(dataFile, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`Patched ${touched} test_item_detail rows in data.json`);
