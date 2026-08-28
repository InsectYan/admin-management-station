'use strict';

/** 一个 turns 入口按 scene 分发 Skill。前端只传 scene，不传 skill 名。 */

const BRAINSTORM = 'novel-brainstorm-skill';
const WRITER = 'novel-writer-skill';

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
};
