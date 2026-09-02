import { salvagePatchFromContent, displayMessageContent } from './aiReplyText.js';

const ROLE_LABELS = { main: '主角', support: '配角', villain: '反派' };
const FACTION_LABELS = { hero: '正派', villain: '反派', neutral: '中立' };

const PATCH_TEXT_FIELDS = [
  ['title', '小说名称'],
  ['creative_intent', '小说立意'],
  ['summary', '小说简介'],
  ['era', '时代背景'],
  ['geography', '地理环境'],
  ['social_rules', '社会规则'],
  ['power_system', '力量体系'],
  ['technology', '科技水平'],
  ['history_notes', '历史概览'],
];

const DROP_THINK_LINE = /^(ready\.?|output generation\.?|i will strictly follow this\.?|content matches requirements\.?|wait,? i must not output code fences.*)$/i;

const THINK_PHRASES = [
  [/novel-writer-skill/gi, '林间写手'],
  [/novel-brainstorm-skill/gi, '林间灵感'],
  [/novel-orchestrator-skill/gi, '林间策'],
  [/Loop Agent 初始化/g, '初始化写手'],
  [/准备第\s*(\d+)\/(\d+)\s*步 LLM 调用/g, '准备第 $1/$2 步模型调用'],
  [/Loop 第\s*(\d+)\/(\d+)\s*步…?/g, '第 $1/$2 步'],
  [/Loop 执行完成/g, '本轮完成'],
  [/正在调用模型…?/g, '正在调用模型'],
  [/正在流式生成…?/g, '正在生成'],
  [/Output Generation/gi, '开始落笔'],
  [/\binvoke(?:Skill|Stream)?\b/gi, '调用'],
  [/\btool call\b/gi, '调用工具'],
  [/\bbrainstorm\b/gi, '灵感发散'],
];

function hasValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function addLabel(labels, cond, label) {
  if (cond && !labels.includes(label)) labels.push(label);
}

export function collectContextLabels(bound = {}) {
  const basic = bound.basic && typeof bound.basic === 'object' ? bound.basic : {};
  const world = bound.world && typeof bound.world === 'object' ? bound.world : {};
  const labels = [];
  addLabel(labels, hasValue(basic.title || bound.title), '小说名称');
  addLabel(labels, hasValue(basic.creative_intent || bound.creative_intent), '小说立意');
  addLabel(labels, hasValue(basic.summary || bound.summary), '小说简介');
  addLabel(labels, hasValue(basic.genre || basic.genre_label || basic.genre_subcategory || bound.genre), '小说类型');
  addLabel(labels, hasValue(basic.themes || bound.themes), '题材');
  addLabel(labels, hasValue(basic.novel_type || basic.length || bound.novel_type), '篇幅');
  addLabel(labels, hasValue(basic.target_audience || bound.target_audience), '目标读者');
  addLabel(labels, hasValue(basic.update_cadence || bound.update_cadence), '更新节奏');
  addLabel(labels, hasValue(bound.era || world.era), '时代背景');
  addLabel(labels, hasValue(bound.geography || world.geography), '地理环境');
  addLabel(labels, hasValue(bound.social_rules || world.social_rules), '社会规则');
  addLabel(labels, hasValue(bound.power_system || world.power_system), '力量体系');
  addLabel(labels, hasValue(bound.technology || world.technology), '科技水平');
  addLabel(labels, hasValue(bound.history_notes || world.history_notes), '历史概览');
  addLabel(labels, hasValue(bound.timeline || world.timeline), '时间轴');
  addLabel(labels, hasValue(bound.factions), '门派组织');
  addLabel(labels, hasValue(bound.characters), '人物');
  addLabel(labels, hasValue(bound.character_edges), '人物关系');
  addLabel(labels, hasValue(bound.body || bound.body_excerpt || bound.chapter), '本章正文');
  addLabel(labels, hasValue(bound.prev_chapter?.ending || bound.prev_ending), '上一章结尾');
  addLabel(labels, hasValue(bound.next_outline), '下一章钩子');
  addLabel(labels, bound.word_target != null && bound.word_target !== '', '目标字数');
  addLabel(labels, hasValue(bound.volumes), '大纲');
  addLabel(labels, hasValue(bound.chapters), '章节');
  addLabel(labels, hasValue(bound.outline_titles), '大纲小节');
  return labels;
}

export function thinkingContextLabels(row) {
  const stored = row?.patch_json?.context_labels;
  return Array.isArray(stored) ? stored.filter(Boolean) : [];
}

export function localizeThinking(raw) {
  let text = String(raw || '');
  for (const [pattern, replacement] of THINK_PHRASES) {
    text = text.replace(pattern, replacement);
  }
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !DROP_THINK_LINE.test(line.trim()))
    .join('\n')
    .trim();
}

function alreadyShown(reply, value) {
  const snippet = String(value || '').trim().slice(0, 24);
  return Boolean(snippet && reply.includes(snippet));
}

export function formatPatchPreview(patch = {}, reply = '') {
  if (!patch || typeof patch !== 'object') return '';
  const parts = [];
  for (const [key, label] of PATCH_TEXT_FIELDS) {
    const value = patch[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    if (alreadyShown(reply, value)) continue;
    parts.push(`**${label}**\n\n${value.trim()}`);
  }
  if (Array.isArray(patch.timeline) && patch.timeline.length) {
    const lines = patch.timeline
      .map((item) => `- ${item.year || '—'}：${item.event || ''}`)
      .join('\n');
    parts.push(`**时间轴**\n\n${lines}`);
  }
  if (Array.isArray(patch.factions) && patch.factions.length) {
    const lines = patch.factions.map((row) => `- ${row.name || '未命名组织'}`).join('\n');
    parts.push(`**门派组织**\n\n${lines}`);
  }
  if (typeof patch.body === 'string' && patch.body.trim()) {
    parts.push(`**本章正文**\n\n${patch.body.slice(0, 800)}${patch.body.length > 800 ? '…' : ''}`);
  }
  if (Array.isArray(patch.characters) && patch.characters.length) {
    const lines = patch.characters
      .map((row) => `- ${row.name || '未命名'}（${ROLE_LABELS[row.role] || row.role || '角色'}）`)
      .join('\n');
    parts.push(`**人物**\n\n${lines}`);
  }
  if (Array.isArray(patch.volumes) && patch.volumes.length) {
    const lines = patch.volumes.map((vol) => `- ${vol.title || '未命名卷'}`).join('\n');
    parts.push(`**大纲**\n\n${lines}`);
  }
  if (Array.isArray(patch.chapters) && patch.chapters.length) {
    const lines = patch.chapters
      .map((ch) => `- ${ch.title || '未命名'}（${FACTION_LABELS[ch.faction] || ch.faction || ''}）`)
      .join('\n');
    parts.push(`**章节**\n\n${lines}`);
  }
  return parts.join('\n\n');
}

export function displayAssistantBody(row) {
  const reply = displayMessageContent(row);
  const stored = row?.patch_json;
  const patch = stored && typeof stored === 'object' && Object.keys(stored).length
    ? stored
    : salvagePatchFromContent(row?.content);
  const preview = formatPatchPreview(patch, reply);
  if (preview && reply) return `${reply}\n\n${preview}`;
  return preview || reply;
}
