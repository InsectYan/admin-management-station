'use strict';

const PERSON_SLOTS = [ '性别', '年龄', '身高', '体态', '脸型', '眉眼', '鼻唇', '发型', '肤色', '服装' ];
const SCENE_SLOTS = [ '空间', '尺度', '陈设', '光线' ];

function clean(value, limit) {
  return String(value || '').replace(/[|\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function slotLine(label, slot) {
  const text = clean(slot?.text, 80);
  if (!text) return '';
  const source = slot?.source === '原文' ? '原文' : '轻推';
  return `${label}：${text}｜${source}｜${clean(slot?.basis, 40)}`;
}

function formatCharacter(item) {
  const tone = [ '正向', '负向', '中性' ].includes(item?.tone) ? item.tone : '中性';
  const words = clean(item?.tone_words, 16);
  const lines = [ `定性：${tone}${words ? `（${words}）` : ''}` ];
  PERSON_SLOTS.forEach(label => {
    const line = slotLine(label, item?.slots?.[label]);
    if (line) lines.push(line);
  });
  return lines.join('\n');
}

function formatScene(item) {
  const lines = [];
  SCENE_SLOTS.forEach(label => {
    const line = slotLine(label, item?.slots?.[label]);
    if (line) lines.push(line);
  });
  return lines.join('\n');
}

function parseLine(line) {
  const matched = String(line || '').match(/^([^：:]{1,8})[：:](.*)$/);
  if (!matched) return null;
  const label = matched[1].trim();
  const rest = matched[2];
  if (label === '定性') {
    const tone = rest.includes('负向') ? '负向' : (rest.includes('正向') ? '正向' : '中性');
    return { label, tone, words: rest.match(/（([^）]*)）/)?.[1] || '' };
  }
  const parts = rest.split('｜');
  const text = clean(parts[0], 80);
  if (!text) return null;
  return {
    label,
    text,
    source: clean(parts[1], 8) === '原文' ? '原文' : '轻推',
    basis: clean(parts[2], 40),
  };
}

function parseDescription(text, kind) {
  const lines = String(text || '').split('\n').map(item => item.trim()).filter(Boolean);
  if (!lines.length) return null;
  if (kind === 'character' && !lines[0].startsWith('定性')) return null;
  if (kind === 'scene' && !/^(空间|尺度|陈设|光线)[：:]/.test(lines[0])) return null;
  const slots = {};
  let tone = '中性';
  let toneWords = '';
  lines.forEach(line => {
    const row = parseLine(line);
    if (!row) return;
    if (row.label === '定性') {
      tone = row.tone;
      toneWords = row.words;
      return;
    }
    slots[row.label] = { text: row.text, source: row.source, basis: row.basis };
  });
  return { tone, tone_words: toneWords, slots };
}

function mergeSlots(current, incoming, labels) {
  const next = { ...(current || {}) };
  labels.forEach(label => {
    const kept = next[label];
    const added = incoming?.[label];
    if (!added?.text) return;
    if (!kept?.text || (kept.source !== '原文' && added.source === '原文')) next[label] = added;
  });
  return next;
}

function mergeCharacter(description, incoming) {
  const current = parseDescription(description, 'character');
  if (String(description || '').trim() && !current) return { description, changed: false };
  const base = current || { tone: '中性', tone_words: '', slots: {} };
  const tone = base.tone === '中性' && incoming?.tone && incoming.tone !== '中性' ? incoming.tone : base.tone;
  const toneWords = base.tone_words || clean(incoming?.tone_words, 16);
  const slots = mergeSlots(base.slots, incoming?.slots, PERSON_SLOTS);
  const next = formatCharacter({ tone, tone_words: toneWords, slots });
  return { description: next, changed: next !== String(description || '').trim() };
}

function mergeScene(description, incoming) {
  const current = parseDescription(description, 'scene');
  if (String(description || '').trim() && !current) return { description, changed: false };
  const slots = mergeSlots(current?.slots, incoming?.slots, SCENE_SLOTS);
  const next = formatScene({ slots });
  return { description: next, changed: Boolean(next) && next !== String(description || '').trim() };
}

function appendCostume(note, chapterTitle, costume) {
  const text = clean(costume, 80);
  if (!text) return String(note || '');
  const line = `${clean(chapterTitle, 40) || '本章'}：${text}`;
  const current = String(note || '').trim();
  if (current.includes(line)) return current;
  return [ current, line ].filter(Boolean).join('\n').slice(0, 2000);
}

function sceneTypeOf(slots) {
  const text = String(slots?.空间?.text || '');
  if (text.includes('室外')) return '室外';
  if (text.includes('室内')) return '室内';
  return '';
}

function splitBody(body, size = 8000) {
  const text = String(body || '').trim();
  if (!text) return [];
  if (text.length <= size) return [ text ];
  const parts = [];
  let rest = text;
  while (rest) {
    if (rest.length <= size) {
      parts.push(rest);
      break;
    }
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = size;
    const piece = rest.slice(0, cut).trim();
    if (piece) parts.push(piece);
    rest = rest.slice(cut).trim();
  }
  return parts;
}

function rosterText(assets) {
  return (Array.isArray(assets) ? assets : [])
    .filter(item => !item.disabled && (item.kind === 'character' || item.kind === 'scene'))
    .map(item => {
      const kind = item.kind === 'scene' ? '场景' : '人物';
      const description = String(item.description || '').replace(/\n/g, '；').slice(0, 240);
      return `${kind}｜${String(item.name || '').trim()}｜${description}`;
    })
    .join('\n')
    .slice(0, 6000);
}

module.exports = {
  PERSON_SLOTS,
  SCENE_SLOTS,
  formatCharacter,
  formatScene,
  parseDescription,
  mergeCharacter,
  mergeScene,
  appendCostume,
  sceneTypeOf,
  splitBody,
  rosterText,
};
