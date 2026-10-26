'use strict';

// 与前端 novelCreateSchema.WIZARD_STEPS、novelDetail.STUDIO_TAB 对齐：章节目录是第 10 步，单章开发是第 11 页。
const CONTENT_STEP = 10;
const STUDIO_TAB = 11;

const PLAN_STEPS = [
  {
    id: 't_basic',
    path: 'plan.basic',
    step: 1,
    feature_key: 'basic',
    writer_action: 'fill_basic',
    scene: 'basic',
    depends_on: [],
    label: '基础信息',
  },
  {
    id: 't_world',
    path: 'plan.world',
    step: 2,
    feature_key: 'world',
    writer_action: 'fill_world',
    scene: 'world',
    depends_on: ['t_basic'],
    label: '世界观',
  },
  {
    id: 't_factions',
    path: 'plan.factions',
    step: 3,
    feature_key: 'factions',
    writer_action: 'fill_factions',
    scene: 'factions',
    depends_on: ['t_world'],
    label: '门派组织',
  },
  {
    id: 't_characters',
    path: 'plan.characters',
    step: 4,
    feature_key: 'characters',
    writer_action: 'fill_characters',
    scene: 'characters',
    depends_on: ['t_factions'],
    label: '人物',
  },
  {
    id: 't_style',
    path: 'plan.style',
    step: 5,
    feature_key: 'style',
    writer_action: 'fill_style',
    scene: 'style',
    depends_on: ['t_characters'],
    label: '风格',
  },
  {
    id: 't_plotline',
    path: 'plan.plotline',
    step: 6,
    feature_key: 'plotline',
    writer_action: 'fill_plotlines',
    scene: 'plotline',
    depends_on: ['t_style'],
    label: '剧情线',
  },
  {
    id: 't_outline',
    path: 'plan.outline',
    step: 7,
    feature_key: 'outline',
    writer_action: 'fill_outline',
    scene: 'outline',
    depends_on: ['t_plotline'],
    label: '大纲',
  },
  {
    id: 't_script',
    path: 'plan.script',
    step: 8,
    feature_key: 'script',
    writer_action: 'fill_script',
    scene: 'script',
    depends_on: ['t_outline'],
    label: '剧本',
  },
  {
    id: 't_intent',
    path: 'plan.intent',
    step: 9,
    feature_key: 'intent',
    writer_action: 'fill_intent_shots',
    scene: 'intent',
    depends_on: ['t_script'],
    label: '叙事分镜',
  },
  {
    id: 't_content',
    path: 'plan.content',
    step: CONTENT_STEP,
    feature_key: 'content',
    writer_action: 'fill_chapters',
    scene: 'content',
    depends_on: ['t_intent'],
    label: '章节目录',
  },
  {
    id: 't_bodies',
    path: 'plan.bodies',
    step: STUDIO_TAB,
    feature_key: 'chapter',
    coverage_key: 'bodies',
    writer_action: 'fill_chapter_body',
    scene: 'chapter.body',
    depends_on: ['t_content'],
    label: '单章正文',
  },
];

const PLAN_BY_PATH = new Map(PLAN_STEPS.map((row) => [row.path, row]));
const PLAN_BY_ID = new Map(PLAN_STEPS.map((row) => [row.id, row]));
const PLAN_STATUSES = new Set(['pending', 'skip', 'optional_rewrite', 'applied']);
const DONE_STATUSES = new Set(['skip', 'applied']);

function coverageFromNovel(novel, setting = {}, extras = {}) {
  const world = setting.world || {};
  const factions = Array.isArray(setting.factions) ? setting.factions : [];
  return {
    basic: Boolean(String(novel?.title || '').trim()),
    world: Boolean(world.era || world.power_system || world.geography),
    factions: factions.some((row) => row && String(row.name || '').trim()),
    characters: Array.isArray(setting.characters) && setting.characters.length > 0,
    style: Boolean(String(novel?.style_preset || '').trim()),
    plotline: Number(extras.plotlineCount) > 0,
    outline: Array.isArray(setting.outline?.volumes) && setting.outline.volumes.length > 0,
    script: Number(extras.scriptCount) > 0,
    intent: Number(extras.intentCount) > 0,
    content: Array.isArray(setting.chapters) && setting.chapters.length > 0,
    bodies: extras.bodiesComplete === true,
  };
}

function clipReason(value, fallback) {
  const text = String(value == null ? '' : value).trim().slice(0, 200);
  return text || fallback;
}

function sanitizeTasks(raw, coverage = {}) {
  const incoming = new Map();
  for (const row of Array.isArray(raw) ? raw : []) {
    if (!row || typeof row !== 'object') continue;
    const def = PLAN_BY_PATH.get(row.path) || PLAN_BY_ID.get(row.id);
    if (def) incoming.set(def.path, row);
  }
  return PLAN_STEPS.map((def) => {
    const row = incoming.get(def.path) || {};
    let status = PLAN_STATUSES.has(row.status) ? row.status : 'pending';
    if (status === 'applied') status = 'pending';
    const covered = Boolean(coverage[def.coverage_key || def.feature_key]);
    if (covered && status === 'pending') status = 'skip';
    if (!covered && status === 'skip') status = 'pending';
    return {
      id: def.id,
      path: def.path,
      step: def.step,
      feature_key: def.feature_key,
      writer_action: def.writer_action,
      depends_on: [...def.depends_on],
      reason: clipReason(row.reason, covered ? `「${def.label}」已有内容，默认跳过` : `待补${def.label}`),
      status,
    };
  });
}

function isBodyTask(task) {
  return task?.feature_key === 'chapter' || task?.path === 'plan.bodies';
}

function findTask(tasks, { task_id, task_path, scope } = {}) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (task_id) {
    const hit = list.find((row) => row.id === task_id);
    if (hit) return hit;
  }
  if (task_path) {
    const hit = list.find((row) => row.path === task_path);
    if (hit) return hit;
  }
  const pending = list.filter((row) => row.status === 'pending');
  if (scope === 'settings') {
    return pending.find((row) => !isBodyTask(row)) || null;
  }
  return pending[0] || null;
}

function assertDependencies(tasks, task) {
  const list = Array.isArray(tasks) ? tasks : [];
  for (const depId of task?.depends_on || []) {
    const dep = list.find((row) => row.id === depId);
    if (!dep) continue;
    if (!DONE_STATUSES.has(dep.status)) {
      const def = PLAN_BY_ID.get(depId);
      const err = new Error(`请先完成「${def?.label || dep.path}」`);
      err.status = 409;
      err.code = 'DEPENDENCY_BLOCKED';
      throw err;
    }
  }
}

function markTaskStatus(tasks, taskId, status) {
  return (Array.isArray(tasks) ? tasks : []).map((row) => (
    row.id === taskId ? { ...row, status } : row
  ));
}

function ensurePlanTasks(raw) {
  const incoming = new Map();
  for (const row of Array.isArray(raw) ? raw : []) {
    if (!row || typeof row !== 'object' || !row.path) continue;
    incoming.set(row.path, row);
  }
  return PLAN_STEPS.map((def) => {
    const row = incoming.get(def.path) || {};
    return {
      id: def.id,
      path: def.path,
      step: def.step,
      feature_key: def.feature_key,
      writer_action: def.writer_action,
      depends_on: [...def.depends_on],
      reason: clipReason(row.reason, `待补${def.label}`),
      status: PLAN_STATUSES.has(row.status) ? row.status : 'pending',
    };
  });
}

module.exports = {
  CONTENT_STEP,
  STUDIO_TAB,
  PLAN_STEPS,
  PLAN_BY_PATH,
  PLAN_BY_ID,
  PLAN_STATUSES,
  DONE_STATUSES,
  coverageFromNovel,
  sanitizeTasks,
  findTask,
  isBodyTask,
  assertDependencies,
  markTaskStatus,
  ensurePlanTasks,
};
