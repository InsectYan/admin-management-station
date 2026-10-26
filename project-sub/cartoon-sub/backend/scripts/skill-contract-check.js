'use strict';

const assert = require('assert');
const { readProductionSource } = require('../../../../../agent-management-master/plugins/_shared/productionSource');
const { parseAssetStep } = require('../../../../../agent-management-master/plugins/cartoon-asset-skill/lib/parseStep');
const { parseVoiceStep } = require('../../../../../agent-management-master/plugins/cartoon-voice-skill/lib/parseStep');
const { parseReviewStep } = require('../../../../../agent-management-master/plugins/cartoon-review-skill/lib/parseStep');
const script = require('../../../../../agent-management-master/plugins/cartoon-script-skill');
const { enrichWriterContext, limitChapters } = require('../../../novel-sub/backend/app/lib/writerContext');
const { modelIssueRows } = require('../../../novel-sub/backend/app/lib/modelFindings');

assert.throws(() => readProductionSource({ package_id: 'pkg', package_version: 2, copy_block_id: 9 }), /不能同时/);
assert.strictEqual(readProductionSource({ package_id: 'pkg', package_version: 2 }).copy_block_id, '');

const asset = parseAssetStep(JSON.stringify({
  suggestions: [
    { shot_id: '1', asset_id: '8', reason: '客栈' },
    { shot_id: '1', asset_id: '99', reason: '不存在' },
  ],
}), { input: { shots: [{ id: 1 }], assets: [{ id: 8 }] } });
assert.deepStrictEqual(asset.suggestions.map(item => item.asset_id), [ '8' ]);

const voice = parseVoiceStep(JSON.stringify({
  cues: [{ shot_id: '3', text: '改掉的情节', start_ms: 0, end_ms: 9000, voice_key: 'other' }],
}), { input: { voice_key: 'narrator', shots: [{ id: 3, dialogue: '原台词', duration_ms: 2000 }] } });
assert.strictEqual(voice.cues[0].text, '原台词');
assert.strictEqual(voice.cues[0].end_ms, 2000);
assert.strictEqual(voice.cues[0].voice_key, 'narrator');

const review = parseReviewStep(JSON.stringify({
  pass: true,
  reject: false,
  issues: [{ shot_id: '3', rule_id: '4', level: 'block', message: '出现了禁词甲', node: '配音' }],
}), { input: { shots: [{ id: 3 }], rules: [{ id: 4, kind: 'banned', body: '禁词甲' }] } });
assert.strictEqual(review.pass, undefined);
assert.strictEqual(review.issues[0].message.includes('禁词甲'), false);
assert.strictEqual(review.issues[0].node, 'voice');

const bound = enrichWriterContext({ chapters: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] }, {
  novel: { style_preset: 'sweet', setting_json: { characters: [{ id: 'c1', name: '甲', appearance: '黑发', speech_style: '慢' }] } },
  terms: [{ name: '灵植', definition: '一种植物', category: 'term', status: 'active' }],
  feature: 'chapter',
  chapterId: 'b',
});
assert.strictEqual(bound.style_preset.name, '甜宠');
assert.strictEqual(bound.characters[0].language_style, '慢');
assert.deepStrictEqual(bound.terms.map(item => item.name), [ '灵植' ]);
assert.deepStrictEqual(bound.chapters.map(item => item.id), [ 'a', 'b', 'c' ]);
assert.deepStrictEqual(limitChapters([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], 'c').map(item => item.id), [ 'b', 'c', 'd' ]);

const rows = modelIssueRows([{ code: 'tone', severity: 'error', message: '用了禁词甲', chapter_id: 'b' }], [{
  category: 'banned',
  name: '禁词甲',
  aliases: [],
}]);
assert.strictEqual(rows[0].source, 'model');
assert.strictEqual(rows[0].level, 'block');
assert.strictEqual(rows[0].message.includes('禁词甲'), false);

async function main() {
  await assert.rejects(script.callbacks.beforeExecute({}, {
    body: '正文',
    package_id: 'pkg',
    package_version: 1,
    copy_block_id: '2',
  }), /不能同时/);
  console.log('skill-contract-check ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
