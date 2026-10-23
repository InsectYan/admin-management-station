'use strict';

const assert = require('assert');
const lib = require('../app/lib/storySnapshot');

assert.strictEqual(lib.hashBody('甲'), lib.hashBody('甲'));
assert.notStrictEqual(lib.hashBody('甲'), lib.hashBody('乙'));
assert.strictEqual(lib.releaseState(0, 'a', ''), 'empty');
assert.strictEqual(lib.releaseState(10, 'a', ''), 'written');
assert.strictEqual(lib.releaseState(10, 'a', 'a'), 'published');
assert.strictEqual(lib.releaseState(10, 'b', 'a'), 'revised');

const snap = lib.buildSnapshot({
  novel: { id: 7, title: '示例', project_kind: 'novel', setting_json: { characters: [{ id: 'c1', name: '林夏', appearance: '黑发' }] } },
  chapters: [{ chapter_id: 'ch1', title: '第一章', body: '正文' }],
  terms: [{ id: 1, name: '灵力', aliases: ['灵气'], definition: '力量', category: 'term' }],
});
assert.strictEqual(snap.package_id, 'pkg_7');
assert.strictEqual(snap.chapters[0].body, '正文');
assert.strictEqual(snap.chapters[0].body_hash, lib.hashBody('正文'));
assert.strictEqual(snap.characters[0].appearance, '黑发');
assert.strictEqual(snap.scripts.length, 0);
assert.strictEqual(lib.normalizeScenes([{ location: '青丘', dialogue: '苏木说道天亮了。', shot_size: '特写', duration_ms: 3000 }])[0].shot_size, undefined);
assert.strictEqual(lib.normalizeScenes([{ location: '青丘', dialogue: '苏木说道天亮了。', shot_size: '特写' }])[0].dialogue, '苏木说道天亮了。');
assert.strictEqual(lib.normalizeScenes([{ location: '林地', interior: '外', characters: [ '苏木' ] }])[0].interior, 'out');
const suggested = lib.scriptSuggestion({
  reply: '可填入后再保存',
  script: { title: '林地稿', variant: 'comic', scenes: [{ location: '林地', dialogue: '苏木说道走吧。', camera_move: '推', shot_size: '中景' }] },
}, { chapter_ids: [ 'ch1' ], variant: 'comic' });
assert.strictEqual(suggested.scenes[0].camera_move, undefined);
assert.strictEqual(suggested.scenes[0].shot_size, undefined);
assert.strictEqual(suggested.chapter_ids[0], 'ch1');
assert.strictEqual(suggested.title, '林地稿');
const intentSuggested = lib.intentSuggestion({
  reply: '确认后再写入',
  intent_shots: [{ intent: '苏木醒来', dialogue: '走吧', characters: [ '苏木' ], camera_move: '推', positive_zh: '阳光', location: '林地' }],
}, { script_id: 3, characters: [{ id: 'c1', name: '苏木' }] });
assert.strictEqual(intentSuggested.shots[0].camera_move, undefined);
assert.strictEqual(intentSuggested.shots[0].positive_zh, undefined);
assert.strictEqual(intentSuggested.shots[0].character_ids[0], 'c1');
assert.strictEqual(intentSuggested.shots[0].location, '林地');
assert.strictEqual(intentSuggested.script_id, 3);
const withScript = lib.buildSnapshot({
  novel: { id: 7, title: '示例', setting_json: { characters: [] } },
  chapters: [{ chapter_id: 'ch1', title: '第一章', body: '正文' }],
  terms: [],
  scripts: [{ id: 3, title: '漫剧稿', variant: 'comic', chapter_ids: ['ch1'], scenes: [{ location: '林地', dialogue: '苏木说道走吧。', camera_move: '推' }] }],
});
assert.strictEqual(withScript.scripts[0].scenes[0].camera_move, undefined);
assert.strictEqual(withScript.scripts[0].scenes[0].location, '林地');
const intents = lib.normalizeIntentShots([{ id: 9, intent: '苏木醒来', dialogue: '苏木说道走吧。', camera_move: '推', positive_zh: '阳光' }]);
assert.strictEqual(intents[0].camera_move, undefined);
assert.strictEqual(intents[0].positive_zh, undefined);
assert.strictEqual(intents[0].intent_id, '9');

const blocked = lib.bannedIssues('这里有灵力', [{ name: '灵力', aliases: [], category: 'banned', status: 'active' }], 'ch1');
assert.strictEqual(blocked.length, 1);
assert.strictEqual(blocked[0].level, 'block');
assert.strictEqual(lib.bannedIssues('干净', [{ name: '灵力', category: 'banned' }], 'ch1').length, 0);

const named = lib.nameIssues('苏木说道天亮了。路人甲说不知道。', {
  setting_json: {
    characters: [{ name: '苏木' }, { name: '旧人', status: 'archived' }],
    factions: [{ name: '青云宗' }],
  },
}, [], 'ch1');
assert.strictEqual(named.filter(item => item.rule === 'unknown_name').length, 1);
assert.strictEqual(named.find(item => item.rule === 'unknown_name').level, 'warn');
const archived = lib.nameIssues('旧人说再见。', {
  setting_json: { characters: [{ name: '旧人', status: 'archived' }], factions: [] },
}, [], 'ch1');
assert.strictEqual(archived[0].rule, 'archived_character');
const org = lib.nameIssues('天魔教来了。', {
  setting_json: { characters: [], factions: [{ name: '青云宗' }] },
}, [], 'ch1');
assert.strictEqual(org[0].rule, 'unknown_org');

const chapters = [
  { id: 'a', order: 1, written: true },
  { id: 'b', order: 2, written: true },
];
const openLine = lib.plotlineIssues([{ name: '青囊', kind: 'foreshadow', status: 'active', plant_chapter_id: 'a', payoff_chapter_id: '', events: [] }], chapters);
assert.strictEqual(openLine[0].rule, 'foreshadow_open');
assert.strictEqual(openLine[0].level, 'warn');
const ordered = lib.plotlineIssues([{ name: '青囊', kind: 'foreshadow', status: 'active', plant_chapter_id: 'b', payoff_chapter_id: 'a', events: [] }], chapters);
assert.strictEqual(ordered[0].rule, 'foreshadow_order');
const overdue = lib.plotlineIssues([{ name: '青囊', kind: 'foreshadow', status: 'active', plant_chapter_id: 'a', payoff_chapter_id: 'b', events: [] }], chapters);
assert.strictEqual(overdue.some(item => item.rule === 'foreshadow_overdue'), true);
const resolved = lib.plotlineIssues([{ name: '青囊', kind: 'foreshadow', status: 'resolved', plant_chapter_id: 'a', payoff_chapter_id: '', events: [] }], chapters);
assert.strictEqual(resolved.length, 0);

assert.strictEqual(lib.applySentence('他说原句结束', '原句', '新句'), '他说新句结束');
assert.throws(() => lib.applySentence('没有', '原句', '新句'), /没有这句/);
assert.throws(() => lib.applySentence('原句原句', '原句', '新句'), /多次/);

const same = '苏木说道走吧。';
const next = '苏木说道留下。';
const diff = lib.diffSnapshots({
  version: 1,
  chapters: [{ chapter_id: 'ch1', title: '林地', body: same, body_hash: lib.hashBody(same) }],
  scripts: [],
  intent_shots: [],
}, {
  version: 2,
  chapters: [{ chapter_id: 'ch1', title: '林地', body: next, body_hash: lib.hashBody(next) }],
  scripts: [{ script_id: '3', title: '稿', scenes: [] }],
  intent_shots: [],
});
assert.strictEqual(diff.from, 1);
assert.strictEqual(diff.chapters[0].change, 'changed');
assert.ok(diff.chapters[0].before.includes('走吧'));
assert.ok(diff.chapters[0].after.includes('留下'));
assert.strictEqual(diff.scripts[0].change, 'added');
const quiet = lib.diffSnapshots({
  version: 1,
  chapters: [{ chapter_id: 'ch1', title: '林地', body: same, body_hash: lib.hashBody(same) }],
}, {
  version: 2,
  chapters: [{ chapter_id: 'ch1', title: '林地', body: same, body_hash: lib.hashBody(same) }],
});
assert.strictEqual(quiet.chapters.length, 0);

const templates = require('../app/lib/storyTemplates');
const listed = templates.listStoryTemplates();
assert.deepStrictEqual(listed.map(item => item.id), [ 'web_serial', 'short_drama', 'comic_script', 'game_plot' ]);
const game = templates.storyTemplateDraft('game_plot', '任务稿');
assert.strictEqual(game.project_kind, 'game_plot');
assert.strictEqual(game.setting_json.outline.volumes[0].title, '主线');
assert.strictEqual(game.setting_json.characters.length, 0);
const draft = templates.storyTemplateDraft('short_drama', ' 季稿 ');
assert.strictEqual(draft.project_kind, 'short_drama');
assert.strictEqual(draft.title, '季稿');
assert.strictEqual(draft.setting_json.outline.volumes[0].title, '第一季');
assert.strictEqual(draft.setting_json.characters.length, 0);
assert.strictEqual(draft.setting_json.character_roles.length, 3);
assert.throws(() => templates.storyTemplateDraft('missing', '甲'), /模板不存在/);

console.log('story-snapshot-check ok');
