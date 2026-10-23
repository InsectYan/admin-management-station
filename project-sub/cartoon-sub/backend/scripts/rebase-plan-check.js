'use strict';

const assert = require('assert');
const { sameBody, keepsProductionText, withOverride } = require('../app/lib/rebasePlan');

assert.strictEqual(sameBody({ body_hash: 'a', body: '旧' }, { body_hash: 'a', body: '新' }), true);
assert.strictEqual(sameBody({ body_hash: 'a', body: '旧' }, { body_hash: 'b', body: '新' }), false);
assert.strictEqual(sameBody({ body: '同一段' }, { body: '同一段' }), true);
assert.strictEqual(keepsProductionText({ overridden_fields: [ 'dialogue' ] }), true);
assert.strictEqual(keepsProductionText({ overridden_fields: [ 'description' ] }), true);
assert.strictEqual(keepsProductionText({ overridden_fields: [] }), false);
const next = withOverride(
  { description: '原描述', dialogue: '原台词', overridden_fields: [] },
  { description: '原描述', dialogue: '改过的台词' },
);
assert.deepStrictEqual(next, [ 'dialogue' ]);

console.log('rebase-plan-check ok');
