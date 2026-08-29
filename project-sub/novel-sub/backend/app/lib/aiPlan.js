'use strict';

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
    id: 't_characters',
    path: 'plan.characters',
    step: 3,
    feature_key: 'characters',
    writer_action: 'fill_characters',
    scene: 'characters',
    depends_on: ['t_world'],
    label: '人物',
  },
  {
    id: 't_outline',
    path: 'plan.outline',
    step: 4,
    feature_key: 'outline',
    writer_action: 'fill_outline',
    scene: 'outline',
    depends_on: ['t_characters'],
    label: '大纲',
  },
  {
    id: 't_content',
    path: 'plan.content',
    step: 5,
    feature_key: 'content',
    writer_action: 'fill_chapters',
    scene: 'content',
    depends_on: ['t_outline'],
    label: '章节',
  },
];

const PLAN_BY_PATH = new Map(PLAN_STEPS.map((row) => [row.path, row]));
const PLAN_BY_ID = new Map(PLAN_STEPS.map((row) => [row.id, row]));
const PLAN_STATUSES = new Set(['pending', 'skip', 'optional_rewrite', 'applied']);
const DONE_STATUSES = new Set(['skip', 'applied']);

function coverageFromNovel(novel, setting = {}) {
  const world = setting.world || {};
  return {
    basic: Boolean(String(novel?.title || '').trim()),
    world: Boolean(world.era || world.power_system || world.geography),
    characters: Array.isArray(setting.characters) && setting.characters.length > 0,
    outline: Array.isArray(setting.outline?.volumes) && setting.outline.volumes.length > 0,
    content: Array.isArray(setting.chapters) && setting.chapters.length > 0,
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
    const covered = Boolean(coverage[def.feature_key]);
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

function findTask(tasks, { task_id, task_path } = {}) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (task_id) {
    const hit = list.find((row) => row.id === task_id);
    if (hit) return hit;
  }
  if (task_path) {
    const hit = list.find((row) => row.path === task_path);
    if (hit) return hit;
  }
  return list.find((row) => row.status === 'pending') || null;
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

module.exports = {
  PLAN_STEPS,
  PLAN_BY_PATH,
  PLAN_BY_ID,
  PLAN_STATUSES,
  DONE_STATUSES,
  coverageFromNovel,
  sanitizeTasks,
  findTask,
  assertDependencies,
  markTaskStatus,
};
