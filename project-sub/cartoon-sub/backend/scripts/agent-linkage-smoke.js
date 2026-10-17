#!/usr/bin/env node
'use strict';

/**
 * 漫剧起草探活：本 BFF 健康、Agent 三个 Skill、一次不调用模型的 invoke。
 * 运行：node scripts/agent-linkage-smoke.js
 */
const cartoonBase = process.env.CARTOON_API_ORIGIN || 'http://127.0.0.1:5205';
const agentBase = (process.env.AGENT_PLATFORM_URL || 'http://127.0.0.1:4001').replace(/\/$/, '');
const names = [ 'cartoon-script-skill', 'cartoon-storyboard-skill', 'cartoon-prompt-skill' ];

async function main() {
  const health = await fetch(`${cartoonBase}/api/health`);
  if (!health.ok) throw new Error(`漫剧健康检查 ${health.status}`);
  const plugins = await fetch(`${agentBase}/api/plugins`);
  if (!plugins.ok) throw new Error(`Agent 插件列表 ${plugins.status}`);
  const body = await plugins.json();
  const have = new Set((body.plugins || []).map(item => item.name));
  const missing = names.filter(name => !have.has(name));
  if (missing.length) throw new Error(`缺少 Skill：${missing.join('、')}`);
  const invoked = await fetch(`${agentBase}/api/skills/cartoon-script-skill/invoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'draft' }),
  });
  const payload = await invoked.json();
  if (invoked.status !== 400 || !String(payload.error || '').includes('章节正文')) {
    throw new Error(`空正文应被拦住，实际 ${invoked.status} ${JSON.stringify(payload)}`);
  }
  console.log('ok', names.join(', '));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
