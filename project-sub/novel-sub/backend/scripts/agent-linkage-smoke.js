#!/usr/bin/env node
'use strict';

/**
 * 小说 Agent 联调探活（需 novel BFF + Agent 平台已启动）
 * 运行：cd backend && npm run agent:smoke
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const novelBase = `http://127.0.0.1:${process.env.NOVEL_PORT || process.env.PORT || 5201}`;
const agentBase = (process.env.AGENT_PLATFORM_URL || 'http://127.0.0.1:4001').replace(/\/$/, '');
const EXPECTED_SKILLS = ['novel-writer-skill', 'novel-brainstorm-skill', 'novel-orchestrator-skill'];

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

function checkPlanStructure() {
  try {
    const { PLAN_STEPS, coverageFromNovel, sanitizeTasks, ensurePlanTasks, findTask } = require('../app/lib/aiPlan');
    const bodies = PLAN_STEPS.find((row) => row.path === 'plan.bodies');
    if (!bodies || bodies.feature_key !== 'chapter' || !bodies.depends_on.includes('t_content')) {
      fail('PLAN_STEPS missing plan.bodies after t_content');
      return;
    }
    const empty = coverageFromNovel(
      { title: 't' },
      { world: { era: 'x' }, factions: [], characters: [{ name: 'a' }] },
    );
    if (empty.factions !== false) {
      fail('coverage factions empty should be false');
      return;
    }
    if (empty.bodies !== false) {
      fail('coverage bodies default false');
      return;
    }
    const tasks = sanitizeTasks([], {
      basic: true,
      world: true,
      factions: true,
      characters: true,
      outline: true,
      content: true,
      bodies: false,
    });
    const bodyTask = tasks.find((row) => row.path === 'plan.bodies');
    if (!bodyTask || bodyTask.status !== 'pending') {
      fail('sanitize t_bodies should stay pending when bodies incomplete');
      return;
    }
    const ensured = ensurePlanTasks([{ path: 'plan.basic', id: 't_basic', status: 'applied', depends_on: [] }]);
    if (ensured.length !== PLAN_STEPS.length || !ensured.find((row) => row.path === 'plan.bodies')) {
      fail('ensurePlanTasks should insert plan.bodies');
      return;
    }
    const mixed = [
      { id: 't_content', path: 'plan.content', feature_key: 'content', status: 'applied' },
      { id: 't_bodies', path: 'plan.bodies', feature_key: 'chapter', status: 'pending' },
    ];
    if (findTask(mixed, { scope: 'settings' })) {
      fail('scope=settings must not pick plan.bodies');
      return;
    }
    const nextWorld = findTask([
      { id: 't_world', path: 'plan.world', feature_key: 'world', status: 'pending' },
      { id: 't_bodies', path: 'plan.bodies', feature_key: 'chapter', status: 'pending' },
    ], { scope: 'settings' });
    if (nextWorld?.path !== 'plan.world') {
      fail('scope=settings should pick next setting task');
      return;
    }
    ok('plan.bodies + coverage factions/bodies + settings scope');
  } catch (err) {
    fail('plan structure', err.message);
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

async function checkWorldScene() {
  try {
    const created = await fetchJson(`${novelBase}/api/ai/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_key: 'world', title: 'smoke-world' }),
    });
    if (created.status >= 400 || created.body?.code !== 0) {
      fail('POST world session', created.body?.message || `HTTP ${created.status}`);
      return;
    }
    const sessionId = created.body.data?.id;
    const turns = await fetchJson(`${novelBase}/api/ai/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '补一套力量体系',
        scene: 'world.power',
        target_fields: ['power_system'],
      }),
    });
    const code = turns.body?.error_code;
    if (code === 'NOVEL_REQUIRED' || (turns.status === 400 && /保存基础信息/.test(turns.body?.message || ''))) {
      ok('world.power gated by novel_id');
    } else if (code === 'SCENE_NOT_IMPLEMENTED') {
      fail('world.power still 501');
    } else {
      fail('world.power expected NOVEL_REQUIRED', turns.body?.message || `HTTP ${turns.status}`);
    }
  } catch (err) {
    fail('world scene', err.message);
  }
}

async function checkCharacterScene() {
  try {
    const created = await fetchJson(`${novelBase}/api/ai/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_key: 'characters', title: 'smoke-cast' }),
    });
    if (created.status >= 400 || created.body?.code !== 0) {
      fail('POST characters session', created.body?.message || `HTTP ${created.status}`);
      return;
    }
    const sessionId = created.body.data?.id;
    const turns = await fetchJson(`${novelBase}/api/ai/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '给 1 主角 1 反派',
        scene: 'characters.cast',
        target_fields: ['characters'],
      }),
    });
    const code = turns.body?.error_code;
    if (code === 'NOVEL_REQUIRED' || (turns.status === 400 && /保存基础信息/.test(turns.body?.message || ''))) {
      ok('characters.cast gated by novel_id');
    } else if (code === 'SCENE_NOT_IMPLEMENTED') {
      fail('characters.cast still 501');
    } else {
      fail('characters.cast expected NOVEL_REQUIRED', turns.body?.message || `HTTP ${turns.status}`);
    }
  } catch (err) {
    fail('characters scene', err.message);
  }
}

async function checkFactionScene() {
  try {
    const created = await fetchJson(`${novelBase}/api/ai/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_key: 'factions', title: 'smoke-factions' }),
    });
    if (created.status >= 400 || created.body?.code !== 0) {
      fail('POST factions session', created.body?.message || `HTTP ${created.status}`);
      return;
    }
    const sessionId = created.body.data?.id;
    const turns = await fetchJson(`${novelBase}/api/ai/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '补两家门派',
        scene: 'factions.list',
        target_fields: ['factions'],
      }),
    });
    const code = turns.body?.error_code;
    if (code === 'NOVEL_REQUIRED' || (turns.status === 400 && /保存基础信息/.test(turns.body?.message || ''))) {
      ok('factions.list gated by novel_id');
    } else if (code === 'SCENE_NOT_IMPLEMENTED') {
      fail('factions.list still 501');
    } else {
      fail('factions.list expected NOVEL_REQUIRED', turns.body?.message || `HTTP ${turns.status}`);
    }
  } catch (err) {
    fail('factions scene', err.message);
  }
}

async function checkChapterBodyScene() {
  try {
    const created = await fetchJson(`${novelBase}/api/ai/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_key: 'chapter', title: 'smoke-chapter' }),
    });
    if (created.status >= 400 || created.body?.code !== 0) {
      fail('POST chapter session', created.body?.message || `HTTP ${created.status}`);
      return;
    }
    const sessionId = created.body.data?.id;
    const turns = await fetchJson(`${novelBase}/api/ai/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '写这一章开头',
        scene: 'chapter.body',
        target_fields: ['body'],
      }),
    });
    const code = turns.body?.error_code;
    if (code === 'NOVEL_REQUIRED' || (turns.status === 400 && /保存基础信息/.test(turns.body?.message || ''))) {
      ok('chapter.body gated by novel_id');
    } else if (code === 'SCENE_NOT_IMPLEMENTED') {
      fail('chapter.body still 501');
    } else {
      fail('chapter.body expected NOVEL_REQUIRED', turns.body?.message || `HTTP ${turns.status}`);
    }
  } catch (err) {
    fail('chapter scene', err.message);
  }
}

async function checkContentScene() {
  try {
    const created = await fetchJson(`${novelBase}/api/ai/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_key: 'content', title: 'smoke-content' }),
    });
    if (created.status >= 400 || created.body?.code !== 0) {
      fail('POST content session', created.body?.message || `HTTP ${created.status}`);
      return;
    }
    const sessionId = created.body.data?.id;
    const turns = await fetchJson(`${novelBase}/api/ai/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '按大纲生成章节标题',
        scene: 'content.chapters',
        target_fields: ['chapters'],
      }),
    });
    const code = turns.body?.error_code;
    if (code === 'NOVEL_REQUIRED' || (turns.status === 400 && /保存基础信息/.test(turns.body?.message || ''))) {
      ok('content.chapters gated by novel_id');
    } else if (code === 'SCENE_NOT_IMPLEMENTED') {
      fail('content.chapters still 501');
    } else {
      fail('content.chapters expected NOVEL_REQUIRED', turns.body?.message || `HTTP ${turns.status}`);
    }
  } catch (err) {
    fail('content scene', err.message);
  }
}

async function checkOutlineScene() {
  try {
    const created = await fetchJson(`${novelBase}/api/ai/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_key: 'outline', title: 'smoke-outline' }),
    });
    if (created.status >= 400 || created.body?.code !== 0) {
      fail('POST outline session', created.body?.message || `HTTP ${created.status}`);
      return;
    }
    const sessionId = created.body.data?.id;
    const turns = await fetchJson(`${novelBase}/api/ai/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '拆三卷',
        scene: 'outline.volumes',
        target_fields: ['volumes'],
      }),
    });
    const code = turns.body?.error_code;
    if (code === 'NOVEL_REQUIRED' || (turns.status === 400 && /保存基础信息/.test(turns.body?.message || ''))) {
      ok('outline.volumes gated by novel_id');
    } else if (code === 'SCENE_NOT_IMPLEMENTED') {
      fail('outline.volumes still 501');
    } else {
      fail('outline.volumes expected NOVEL_REQUIRED', turns.body?.message || `HTTP ${turns.status}`);
    }
  } catch (err) {
    fail('outline scene', err.message);
  }
}

async function checkOrchestrateScene() {
  try {
    const created = await fetchJson(`${novelBase}/api/ai/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_key: 'orchestrate', title: 'smoke-plan' }),
    });
    if (created.status >= 400 || created.body?.code !== 0) {
      fail('POST orchestrate session', created.body?.message || `HTTP ${created.status}`);
      return;
    }
    const sessionId = created.body.data?.id;
    const turns = await fetchJson(`${novelBase}/api/ai/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '', scene: 'orchestrate' }),
    });
    const code = turns.body?.error_code;
    if (code === 'SCENE_NOT_IMPLEMENTED') {
      fail('orchestrate still 501');
    } else if (code === 'NOVEL_REQUIRED') {
      fail('orchestrate should not require novel_id');
    } else if (code === 'MESSAGE_REQUIRED' || (turns.status === 400 && /输入/.test(turns.body?.message || ''))) {
      ok('orchestrate scene open (no novel_id)');
    } else {
      fail('orchestrate expected MESSAGE_REQUIRED', turns.body?.message || `HTTP ${turns.status}`);
    }

    const bodiesScene = await fetchJson(`${novelBase}/api/ai/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '', scene: 'orchestrate.bodies' }),
    });
    const bodiesCode = bodiesScene.body?.error_code;
    if (bodiesCode === 'SCENE_NOT_IMPLEMENTED') {
      fail('orchestrate.bodies still 501');
    } else if (bodiesCode === 'MESSAGE_REQUIRED' || (bodiesScene.status === 400 && /输入/.test(bodiesScene.body?.message || ''))) {
      ok('orchestrate.bodies scene open');
    } else {
      fail('orchestrate.bodies expected MESSAGE_REQUIRED', bodiesScene.body?.message || `HTTP ${bodiesScene.status}`);
    }
  } catch (err) {
    fail('orchestrate scene', err.message);
  }
}

async function checkDispatchGate() {
  try {
    const missing = await fetchJson(`${novelBase}/api/ai/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const missCode = missing.body?.error_code;
    if (missCode === 'PLAN_SESSION_REQUIRED' || (missing.status === 400 && /plan_session/.test(missing.body?.message || ''))) {
      ok('dispatch requires plan_session_id');
    } else {
      fail('dispatch expected PLAN_SESSION_REQUIRED', missing.body?.message || `HTTP ${missing.status}`);
    }

    const created = await fetchJson(`${novelBase}/api/ai/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_key: 'orchestrate', title: 'smoke-dispatch' }),
    });
    const sessionId = created.body?.data?.id;
    if (!sessionId) {
      fail('dispatch session missing id');
      return;
    }
    const disp = await fetchJson(`${novelBase}/api/ai/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_session_id: sessionId, task_path: 'plan.characters' }),
    });
    const code = disp.body?.error_code;
    if (code === 'PLAN_REQUIRED' || (disp.status === 400 && /开书计划/.test(disp.body?.message || ''))) {
      ok('dispatch gated by plan');
    } else if (code === 'DEPENDENCY_BLOCKED') {
      ok('dispatch characters blocked until world applied');
    } else {
      fail('dispatch expected PLAN_REQUIRED', disp.body?.message || `HTTP ${disp.status}`);
    }

    const bodies = await fetchJson(`${novelBase}/api/ai/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_session_id: sessionId, task_path: 'plan.bodies' }),
    });
    const bodiesCode = bodies.body?.error_code;
    if (bodiesCode === 'PLAN_REQUIRED' || (bodies.status === 400 && /开书计划/.test(bodies.body?.message || ''))) {
      ok('dispatch plan.bodies gated by plan');
    } else if (bodiesCode === 'DEPENDENCY_BLOCKED') {
      ok('dispatch plan.bodies blocked until chapters applied');
    } else {
      fail('dispatch plan.bodies expected PLAN_REQUIRED', bodies.body?.message || `HTTP ${bodies.status}`);
    }
  } catch (err) {
    fail('dispatch gate', err.message);
  }
}

async function checkMediaProfiles() {
  try {
    const { status, body } = await fetchJson(`${agentBase}/api/media/profiles`);
    if (status !== 200) {
      fail('GET /api/media/profiles', `HTTP ${status}`);
      return;
    }
    const profiles = body?.profiles || [];
    if (!profiles.length) {
      fail('media catalog empty');
      return;
    }
    const withCaps = profiles.filter((p) => Array.isArray(p.capabilities) && p.capabilities.length);
    if (withCaps.length === profiles.length) ok(`media catalog ${profiles.length} profiles with capabilities`);
    else fail('media profiles missing capabilities', `${withCaps.length}/${profiles.length}`);
  } catch (err) {
    fail('GET /api/media/profiles', err.message);
  }
}

async function checkCoverGenerateGate() {
  try {
    const empty = await fetchJson(`${novelBase}/api/ai/cover/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const code = empty.body?.error_code;
    if (code === 'COVER_CONTEXT_REQUIRED' || (empty.status === 400 && /书名|提示词/.test(empty.body?.message || ''))) {
      ok('cover generate requires title or prompt');
    } else {
      fail('cover generate expected COVER_CONTEXT_REQUIRED', empty.body?.message || `HTTP ${empty.status}`);
    }
  } catch (err) {
    fail('cover generate gate', err.message);
  }
}

async function checkChapterRoutes() {
  try {
    const empty = await fetchJson(`${novelBase}/api/novels/0/chapters/empty`);
    if (empty.status === 404) ok('GET chapters/empty 404 for missing novel');
    else fail('chapters/empty expected 404', empty.body?.message || `HTTP ${empty.status}`);
  } catch (err) {
    fail('chapters/empty', err.message);
  }
  try {
    const reader = await fetchJson(`${novelBase}/api/novels/0/reader`);
    if (reader.status === 404) ok('GET reader 404 for missing novel');
    else fail('reader expected 404', reader.body?.message || `HTTP ${reader.status}`);
  } catch (err) {
    fail('reader', err.message);
  }
}

async function main() {
  console.log('novel Agent linkage smoke');
  checkPlanStructure();
  await checkNovelHealth();
  await checkAgentHealth();
  await checkPlugins();
  await checkTurns();
  await checkWorldScene();
  await checkFactionScene();
  await checkCharacterScene();
  await checkChapterBodyScene();
  await checkOutlineScene();
  await checkContentScene();
  await checkOrchestrateScene();
  await checkDispatchGate();
  await checkChapterRoutes();
  await checkMediaProfiles();
  await checkCoverGenerateGate();
  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nall checks passed');
}

main();
