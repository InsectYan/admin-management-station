'use strict';

/**
 * E6 离线冒烟：Skill 规则降级 + k6 脚本生成（无需 Agent 平台 / DB）
 * 运行：node backend/scripts/e6-smoke.js
 */

const path = require('path');

const judgeFallback = require(path.join(
  __dirname,
  '../../../../../agent-management-sub/plugins/fitness-judge-skill/lib/ruleFallback.js',
));
const sampleGen = require(path.join(
  __dirname,
  '../../../../../agent-management-sub/plugins/fitness-sample-skill/lib/sampleGenerator.js',
));
const { buildK6Script } = require('../app/lib/k6ScriptBuilder');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  const observations = [
    { http_status: 200, input_summary: 'ok' },
    { http_status: 500, input_summary: 'fail' },
  ];
  const judge = judgeFallback.ruleBasedJudge(observations, { pass_threshold: 0.5 }, {});
  assert(judge.pass === true, 'judge fallback should pass at 50%');
  assert(judge.score === 0.5, `judge score expected 0.5 got ${judge.score}`);

  const summary = judgeFallback.ruleBasedSummary('Demo Plan', [
    { item_id: 'A1', result_status: 'passed' },
    { item_id: 'A2', result_status: 'failed' },
  ]);
  assert(summary.includes('Demo Plan'), 'summary should include plan name');
  assert(summary.includes('50%'), 'summary should show 50% pass rate');

  const csv = 'path,method,expect_status\n/health,GET,200\n/api/x,POST,201';
  const enriched = sampleGen.enrichCsvRule({ csv_text: csv });
  assert(enriched.samples.length === 2, 'enrich_csv should parse 2 rows');

  const batch = sampleGen.enrichSamplesRule({
    items: [{ item_id: 'T1', test_input_example: 'POST /api/chat' }],
  });
  assert(batch.samples.length >= 1, 'enrich_samples should produce samples');

  const k6 = buildK6Script({ vu: 5, duration_sec: 10, path: '/health' }, { bff_coach_url: 'http://localhost:8080' });
  assert(k6.includes('export const options'), 'k6 script should export options');
  assert(k6.includes('http://localhost:8080'), 'k6 script should include base url');

  console.log('[e6-smoke] all checks passed');
}

try {
  run();
} catch (err) {
  console.error('[e6-smoke] FAILED:', err.message);
  process.exit(1);
}
