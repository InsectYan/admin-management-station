'use strict';

/** 一个 turns 入口按 scene 分发 Skill。前端只传 scene，不传 skill 名。 */

const BRAINSTORM = 'novel-brainstorm-skill';
const WRITER = 'novel-writer-skill';
const ORCHESTRATOR = 'novel-orchestrator-skill';
const {
  WORLD_FIELDS,
  CHARACTER_LIST_FIELDS,
  CHARACTER_SENTINEL,
  OUTLINE_FIELDS,
  CHAPTER_FIELDS,
  FACTION_FIELDS,
  CHAPTER_BODY_FIELDS,
  PLAN_FIELDS,
} = require('./aiPatchSanitize');

function step(skill, action, extra = {}) {
  return { skill, action, ...extra };
}

const BASIC_LEAF = (focus, path) => ({
  pipeline: [
    step(BRAINSTORM, 'ideate', { focus }),
    step(WRITER, 'rewrite_field'),
  ],
  feature_key: 'basic',
  default_target_fields: [path],
});

const WORLD_LEAF = (focus, path) => ({
  pipeline: [
    step(BRAINSTORM, 'ideate', { focus }),
    step(WRITER, 'rewrite_field'),
  ],
  feature_key: 'world',
  default_target_fields: [path],
  require_novel_id: true,
});

const STRUCTURAL_SCENES = new Set([
  'basic.genre',
  'basic.themes',
  'basic.length',
  'basic.audience',
  'basic.pace',
]);

const REGISTRY = {
  basic: {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'auto' }),
      step(WRITER, 'fill_basic'),
    ],
    feature_key: 'basic',
    default_target_fields: ['title', 'creative_intent', 'summary'],
  },
  'basic.title': BASIC_LEAF('title', 'title'),
  'basic.intent': BASIC_LEAF('intent', 'creative_intent'),
  'basic.summary': BASIC_LEAF('summary', 'summary'),

  world: {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'world' }),
      step(WRITER, 'fill_world'),
    ],
    feature_key: 'world',
    default_target_fields: [...WORLD_FIELDS],
    require_novel_id: true,
  },
  'world.era': WORLD_LEAF('era', 'era'),
  'world.geography': WORLD_LEAF('geography', 'geography'),
  'world.social': WORLD_LEAF('social', 'social_rules'),
  'world.power': WORLD_LEAF('power', 'power_system'),
  'world.tech': WORLD_LEAF('tech', 'technology'),
  'world.history': WORLD_LEAF('history', 'history_notes'),
  'world.timeline': WORLD_LEAF('timeline', 'timeline'),

  factions: {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'factions' }),
      step(WRITER, 'fill_factions'),
    ],
    feature_key: 'factions',
    default_target_fields: [...FACTION_FIELDS],
    require_novel_id: true,
  },
  'factions.list': {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'factions' }),
      step(WRITER, 'fill_factions'),
    ],
    feature_key: 'factions',
    default_target_fields: ['factions'],
    require_novel_id: true,
  },
  'factions.current': {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'factions' }),
      step(WRITER, 'fill_factions'),
    ],
    feature_key: 'factions',
    default_target_fields: ['factions'],
    require_novel_id: true,
  },

  characters: {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'cast' }),
      step(WRITER, 'fill_characters'),
    ],
    feature_key: 'characters',
    default_target_fields: [...CHARACTER_LIST_FIELDS],
    require_novel_id: true,
  },
  'characters.cast': {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'cast' }),
      step(WRITER, 'fill_characters'),
    ],
    feature_key: 'characters',
    default_target_fields: ['characters'],
    require_novel_id: true,
  },
  'characters.edges': {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'cast' }),
      step(WRITER, 'fill_characters'),
    ],
    feature_key: 'characters',
    default_target_fields: ['character_edges'],
    require_novel_id: true,
  },
  'characters.current': {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'cast' }),
      step(WRITER, 'rewrite_field'),
    ],
    feature_key: 'characters',
    default_target_fields: [CHARACTER_SENTINEL],
    require_novel_id: true,
  },

  outline: {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'plot' }),
      step(WRITER, 'fill_outline'),
    ],
    feature_key: 'outline',
    default_target_fields: [...OUTLINE_FIELDS],
    require_novel_id: true,
  },
  'outline.volumes': {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'plot' }),
      step(WRITER, 'fill_outline'),
    ],
    feature_key: 'outline',
    default_target_fields: ['volumes'],
    require_novel_id: true,
  },
  'outline.words': {
    pipeline: [
      step(BRAINSTORM, 'ideate', { focus: 'plot' }),
      step(WRITER, 'fill_outline'),
    ],
    feature_key: 'outline',
    default_target_fields: ['word_targets'],
    require_novel_id: true,
  },

  content: {
    pipeline: [step(WRITER, 'fill_chapters')],
    feature_key: 'content',
    default_target_fields: [...CHAPTER_FIELDS],
    require_novel_id: true,
  },
  'content.chapters': {
    pipeline: [step(WRITER, 'fill_chapters')],
    feature_key: 'content',
    default_target_fields: ['chapters'],
    require_novel_id: true,
  },
  'content.faction': {
    pipeline: [step(WRITER, 'fill_chapters')],
    feature_key: 'content',
    default_target_fields: ['faction'],
    require_novel_id: true,
  },
  'content.outline_ref': {
    pipeline: [step(WRITER, 'fill_chapters')],
    feature_key: 'content',
    default_target_fields: ['outline_ref'],
    require_novel_id: true,
  },

  chapter: {
    pipeline: [step(WRITER, 'fill_chapter_body')],
    feature_key: 'chapter',
    default_target_fields: [...CHAPTER_BODY_FIELDS],
    require_novel_id: true,
  },
  'chapter.body': {
    pipeline: [step(WRITER, 'fill_chapter_body')],
    feature_key: 'chapter',
    default_target_fields: ['body'],
    require_novel_id: true,
  },

  orchestrate: {
    pipeline: [step(ORCHESTRATOR, 'plan')],
    feature_key: 'orchestrate',
    default_target_fields: [...PLAN_FIELDS],
  },
  'orchestrate.basic': {
    pipeline: [step(ORCHESTRATOR, 'plan')],
    feature_key: 'orchestrate',
    default_target_fields: [...PLAN_FIELDS],
  },
  'orchestrate.world': {
    pipeline: [step(ORCHESTRATOR, 'plan')],
    feature_key: 'orchestrate',
    default_target_fields: [...PLAN_FIELDS],
  },
  'orchestrate.factions': {
    pipeline: [step(ORCHESTRATOR, 'plan')],
    feature_key: 'orchestrate',
    default_target_fields: [...PLAN_FIELDS],
  },
  'orchestrate.characters': {
    pipeline: [step(ORCHESTRATOR, 'plan')],
    feature_key: 'orchestrate',
    default_target_fields: [...PLAN_FIELDS],
  },
  'orchestrate.outline': {
    pipeline: [step(ORCHESTRATOR, 'plan')],
    feature_key: 'orchestrate',
    default_target_fields: [...PLAN_FIELDS],
  },
  'orchestrate.content': {
    pipeline: [step(ORCHESTRATOR, 'plan')],
    feature_key: 'orchestrate',
    default_target_fields: [...PLAN_FIELDS],
  },
  'orchestrate.bodies': {
    pipeline: [step(ORCHESTRATOR, 'plan')],
    feature_key: 'orchestrate',
    default_target_fields: [...PLAN_FIELDS],
  },
};

function resolveScene(scene) {
  const key = String(scene || '').trim();
  if (!key) {
    const err = new Error('缺少 scene');
    err.status = 400;
    err.code = 'SCENE_REQUIRED';
    throw err;
  }
  if (STRUCTURAL_SCENES.has(key)) {
    const err = new Error('该字段为表单选项，请在表单中手动选择，AI 不生成');
    err.status = 400;
    err.code = 'SCENE_STRUCTURAL';
    throw err;
  }
  const spec = REGISTRY[key];
  if (!spec) {
    const err = new Error(`场景尚未开放：${key}`);
    err.status = 501;
    err.code = 'SCENE_NOT_IMPLEMENTED';
    throw err;
  }
  return { scene: key, ...spec };
}

function invokePath(skillName) {
  return `/api/skills/${skillName}/invoke`;
}

module.exports = {
  REGISTRY,
  STRUCTURAL_SCENES,
  resolveScene,
  invokePath,
  BRAINSTORM,
  WRITER,
  ORCHESTRATOR,
};
