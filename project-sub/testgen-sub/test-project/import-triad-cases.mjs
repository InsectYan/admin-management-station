#!/usr/bin/env node
/**
 * 三端用例注入 testgen-sub
 *
 * 1) 软删现有 test_item_detail（is_active=false）
 * 2) 确保三项目存在
 * 3) POST /api/fitness/items/manual 写入 cases-all.json
 *
 * Usage:
 *   set TESTGEN_BASE_URL=http://127.0.0.1:5202
 *   set TESTGEN_TOKEN=   (可选)
 *   node import-triad-cases.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.TESTGEN_BASE_URL || "http://127.0.0.1:5202").replace(/\/$/, "");
const TOKEN = process.env.TESTGEN_TOKEN || "";
const CASES = JSON.parse(readFileSync(join(here, "cases-all.json"), "utf8"));

const PROJECTS = [
  {
    "project_code": "lejian-wx-miniapp",
    "project_name": "启炼前端 · 微信小程序",
    "team": "QA 团队",
    "status": "active",
    "description": "lejian-wx-miniapp：教练/会员/店长前端呈现、交互、流式卡片与权限门禁。",
    "repo_urls": [
      "lejian-wx-miniapp"
    ],
    "cicd_config": {
      "provider": "manual",
      "pipeline": ""
    },
    "member_roles": [
      {
        "user": "admin",
        "role": "owner"
      }
    ]
  },
  {
    "project_code": "lejian-business-service",
    "project_name": "启炼服务端 · 业务 API",
    "team": "QA 团队",
    "status": "active",
    "description": "lejian-business-service：/miniapp/* 与 /agent/* 接口、状态机、鉴权与 Agent 读数。",
    "repo_urls": [
      "lejian-business-service"
    ],
    "cicd_config": {
      "provider": "manual",
      "pipeline": ""
    },
    "member_roles": [
      {
        "user": "admin",
        "role": "owner"
      }
    ]
  },
  {
    "project_code": "fitness-agent",
    "project_name": "启炼 Agent · Pi",
    "team": "QA 团队",
    "status": "active",
    "description": "fitness-agent/.pi：场景围栏、emit 契约、教练工作流、会员/店长边界与 HTTP。",
    "repo_urls": [
      "fitness-agent"
    ],
    "cicd_config": {
      "provider": "manual",
      "pipeline": "npm test"
    },
    "member_roles": [
      {
        "user": "admin",
        "role": "owner"
      }
    ]
  }
];

function headers(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || res.statusText;
    throw new Error(`${method} ${path} → ${res.status} ${msg}`);
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
        await req("PUT", `/api/projects/${encodeURIComponent(p.project_code)}`, {
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
  console.log(`\nDone. ok=${ok} fail=${fail}`);
  process.exit(fail ? 2 : 0);
}

main();
