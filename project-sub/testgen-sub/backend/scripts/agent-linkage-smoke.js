#!/usr/bin/env node
'use strict';

/**
 * Agent ↔ testgen 在线联调探活（需 BFF + Agent 平台已启动）
 * 运行：cd backend && node scripts/agent-linkage-smoke.js
 * 环境：读取 backend/.env（AGENT_PLATFORM_URL、TESTGEN_PORT、INTERNAL_API_TOKEN）
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const testgenBase = `http://127.0.0.1:${process.env.TESTGEN_PORT || process.env.PORT || 5202}`;
const agentBase = (process.env.AGENT_PLATFORM_URL || 'http://127.0.0.1:4001').replace(/\/$/, '');
const internalToken = process.env.INTERNAL_API_TOKEN || '';

const EXPECTED_SKILLS = [
  'testgen-skill',
  'fitness-judge-skill',
  'fitness-sample-skill',
  'fitness-explore-skill',
  'fitness-config-skill',
];

let failed = 0;

function ok(msg) {
  console.log(`  OK ${msg}`);
}

function fail(msg, detail = '') {
  failed += 1;
  console.error(`  FAIL ${msg}${detail ? `: ${detail}` : ''}`);
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function checkTestgenHealth() {
  const { status, body } = await fetchJson(`${testgenBase}/api/health`);
  if (status === 200 && (body?.code === 0 || body?.data)) {
    ok(`testgen BFF ${testgenBase}/api/health`);
  } else {
    fail('testgen BFF health', `HTTP ${status}`);
  }
}

async function checkAgentHealth() {
  for (const path of [ '/health', '/ready' ]) {
    try {
      const { status } = await fetchJson(`${agentBase}${path}`);
      if (status === 200) ok(`Agent ${agentBase}${path}`);
      else fail(`Agent ${path}`, `HTTP ${status}`);
    } catch (err) {
      fail(`Agent ${path}`, err.message);
    }
  }
}

async function checkPlugins() {
  const { status, body } = await fetchJson(`${agentBase}/api/plugins`);
  if (status !== 200) {
    fail('GET /api/plugins', `HTTP ${status}`);
    return;
  }
  const list = Array.isArray(body) ? body : body?.plugins || body?.data || [];
  const names = list.map(p => p.name || p.id || p.plugin_id || String(p)).filter(Boolean);
  for (const skill of EXPECTED_SKILLS) {
    const hit = names.some(n => String(n).includes(skill.replace('-skill', '')) || String(n) === skill);
    if (hit) ok(`plugin loaded: ${skill}`);
    else fail(`plugin missing: ${skill}`, names.slice(0, 8).join(', ') || '(empty list)');
  }
}

async function checkJudgeInvoke() {
  try {
    const { status, body } = await fetchJson(`${agentBase}/api/skills/fitness-judge-skill/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-rubrics' }),
    });
    if (status === 200 && !body?.error) ok('fitness-judge-skill invoke list-rubrics');
    else fail('fitness-judge invoke', body?.error || `HTTP ${status}`);
  } catch (err) {
    fail('fitness-judge invoke', err.message);
  }
}

async function checkInternalToken() {
  if (!internalToken) {
    console.log('  SKIP internal token（INTERNAL_API_TOKEN 未设，开发模式放行）');
    return;
  }
  const { status: noToken } = await fetchJson(`${testgenBase}/api/internal/fitness/items/suggest?limit=1`);
  if (noToken === 401) ok('internal API rejects missing token');
  else fail('internal API should 401 without token', `HTTP ${noToken}`);

  const { status: withToken } = await fetchJson(`${testgenBase}/api/internal/fitness/items/suggest?limit=1`, {
    headers: { 'X-Internal-Token': internalToken },
  });
  if (withToken === 200) ok('internal API accepts X-Internal-Token');
  else fail('internal API with token', `HTTP ${withToken}`);
}

async function main() {
  console.log('[agent-linkage-smoke]');
  console.log(`  testgen=${testgenBase}`);
  console.log(`  agent=${agentBase}`);
  await checkTestgenHealth();
  await checkAgentHealth();
  await checkPlugins();
  await checkJudgeInvoke();
  await checkInternalToken();
  if (failed) {
    console.error(`\n[agent-linkage-smoke] FAILED (${failed} checks)`);
    process.exit(1);
  }
  console.log('\n[agent-linkage-smoke] all checks passed');
}

main().catch(err => {
  console.error('[agent-linkage-smoke] error:', err);
  process.exit(1);
});
