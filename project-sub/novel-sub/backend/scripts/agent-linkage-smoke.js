#!/usr/bin/env node
'use strict';

/**
 * 小说 Agent 联调探活（需 novel BFF + Agent 平台已启动）
 * 运行：cd backend && npm run agent:smoke
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const novelBase = `http://127.0.0.1:${process.env.NOVEL_PORT || process.env.PORT || 5201}`;
const agentBase = (process.env.AGENT_PLATFORM_URL || 'http://127.0.0.1:4001').replace(/\/$/, '');
const EXPECTED_SKILLS = ['novel-writer-skill', 'novel-brainstorm-skill'];

let failed = 0;

function ok(msg) {
  console.log(`  OK ${msg}`);
}

function fail(msg, detail = '') {
  failed += 1;
  console.error(`  FAIL ${msg}${detail ? `: ${detail}` : ''}`);
}

async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 20000);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function checkNovelHealth() {
  try {
    const { status, body } = await fetchJson(`${novelBase}/api/health`);
    if (status === 200 && (body?.code === 0 || body?.data)) {
      ok(`novel BFF ${novelBase}/api/health`);
    } else {
      fail('novel BFF health', `HTTP ${status}`);
    }
  } catch (err) {
    fail('novel BFF health', err.message);
  }
}

async function checkAgentHealth() {
  try {
    const { status } = await fetchJson(`${agentBase}/health`);
    if (status === 200) ok(`Agent ${agentBase}/health`);
    else fail('Agent /health', `HTTP ${status}`);
  } catch (err) {
    fail('Agent /health', err.message);
  }
}

async function checkPlugins() {
  try {
    const { status, body } = await fetchJson(`${agentBase}/api/plugins`);
    if (status !== 200) {
      fail('GET /api/plugins', `HTTP ${status}`);
      return;
    }
    const list = Array.isArray(body) ? body : body?.plugins || body?.data || [];
    const names = list.map((p) => p.name || p.id || p.plugin_id || String(p)).filter(Boolean);
    for (const skill of EXPECTED_SKILLS) {
      const hit = names.some((n) => String(n) === skill || String(n).includes(skill.replace('-skill', '')));
      if (hit) ok(`plugin loaded: ${skill}`);
      else fail(`plugin missing: ${skill}`, names.slice(0, 10).join(', ') || '(empty list)');
    }
  } catch (err) {
    fail('GET /api/plugins', err.message);
  }
}

async function checkTurns() {
  try {
    const created = await fetchJson(`${novelBase}/api/ai/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_key: 'basic', title: 'smoke-basic' }),
    });
    if (created.status >= 400 || created.body?.code !== 0) {
      fail('POST /api/ai/sessions', created.body?.message || `HTTP ${created.status}`);
      return;
    }
    const sessionId = created.body.data?.id;
    ok(`session created id=${sessionId}`);

    const turns = await fetchJson(`${novelBase}/api/ai/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeoutMs: 180000,
      body: JSON.stringify({
        message: '起个偏江湖气的书名',
        scene: 'basic.title',
        target_fields: ['title'],
        form_snapshot: { title: '' },
      }),
    });
    if (turns.status === 503 || turns.body?.error_code === 'AGENT_UNREACHABLE') {
      fail('POST turns', turns.body?.message || 'Agent 未启动或不可达');
      return;
    }
    if (turns.status >= 400 || turns.body?.code !== 0) {
      fail('POST turns', turns.body?.message || `HTTP ${turns.status}`);
      return;
    }
    const data = turns.body.data || {};
    if (data.reply) ok(`turns reply: ${String(data.reply).slice(0, 80)}`);
    else fail('turns missing reply');
    if (data.patch && Object.prototype.hasOwnProperty.call(data.patch, 'title')) {
      ok(`turns patch.title=${data.patch.title}`);
    } else {
      ok('turns returned (patch.title 可能因未配置 LLM 为空)');
    }
  } catch (err) {
    fail('turns', err.message);
  }
}

async function main() {
  console.log('novel Agent linkage smoke');
  await checkNovelHealth();
  await checkAgentHealth();
  await checkPlugins();
  await checkTurns();
  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nall checks passed');
}

main();
