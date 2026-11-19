'use strict';

const PERSON_SLOTS = [ '性别', '年龄', '身高', '体态', '脸型', '眉眼', '鼻唇', '发型', '肤色', '服装' ];
const SCENE_SLOTS = [ '空间', '尺度', '陈设', '光线' ];

function briefLook(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || /正文未写/.test(text)) return '';
  if (text.length > 60 || /[。！？]/.test(text)) return '';
  return text;
}

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
    if (label === '年龄' && (added?.basis === 'AV至少二十一岁' || added?.basis === '正文岁数') && kept?.source !== '原文') {
      next[label] = added;
      return;
    }
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

const FACT_SLOTS = [ '性别', '年龄' ];

function identityBits(description) {
  const parsed = parseDescription(description, 'character');
  const bits = [];
  if (parsed) {
    FACT_SLOTS.forEach(label => {
      const text = String(parsed.slots?.[label]?.text || '').trim();
      if (text) bits.push(`${label}：${text}`);
    });
    if (parsed.tone && parsed.tone !== '中性') {
      bits.push(`定性：${parsed.tone}${parsed.tone_words ? `（${parsed.tone_words}）` : ''}`);
    }
    return bits.join('，');
  }
  String(description || '').split('\n').forEach(line => {
    const matched = line.trim().match(/^(性别|年龄)[：:]\s*([^｜]+)/);
    if (matched && matched[2].trim()) bits.push(`${matched[1]}：${matched[2].trim()}`);
  });
  return bits.join('，');
}

function cardLine(asset, picture) {
  if (!asset || asset.kind !== 'character' || asset.disabled) return '';
  const name = String(asset.name || '').trim();
  const bits = identityBits(asset.description);
  if (!name || !bits) return '';
  if (picture) {
    const visual = bits.split('，').filter(item => item.startsWith('性别：') || item.startsWith('年龄：')).join('，');
    return visual ? `角色「${name}」人物卡：${visual}` : '';
  }
  return `人物「${name}」${bits}`;
}

function assetFactText(assets) {
  const lines = [];
  const seen = new Set();
  (Array.isArray(assets) ? assets : []).forEach(item => {
    const name = String(item?.name || '').trim();
    if (!name || seen.has(name)) return;
    const line = cardLine(item, false);
    if (!line) return;
    seen.add(name);
    lines.push(line);
  });
  if (!lines.length) return '';
  return [
    '人物卡。年龄、性别、定性以卡片为准。只使用本段实际出场的人。写画面提示词时，有参考图就不要再写脸型、发型、眉眼、鼻唇、体态、肤色、服装。',
    ...lines,
  ].join('\n');
}

function namedAssets(assets, text) {
  const source = String(text || '');
  const cards = (Array.isArray(assets) ? assets : []).filter(item => String(item?.name || '').trim());
  const names = cards.map(item => String(item.name).trim()).sort((a, b) => b.length - a.length);
  const hits = new Set();
  let rest = source;
  names.forEach(name => {
    if (!rest.includes(name)) return;
    hits.add(name);
    rest = rest.split(name).join('\u0000'.repeat(name.length));
  });
  return cards.filter(item => hits.has(String(item.name).trim()));
}

function pictureFactText(assets, names) {
  const wanted = new Set((names || []).map(name => String(name || '').trim()).filter(Boolean));
  const lines = [];
  const seen = new Set();
  (Array.isArray(assets) ? assets : []).forEach(item => {
    const name = String(item?.name || '').trim();
    if (!name || seen.has(name)) return;
    if (wanted.size && !wanted.has(name)) return;
    const line = cardLine(item, true);
    if (!line) return;
    seen.add(name);
    lines.push(line);
  });
  return lines.join('\n');
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
  assetFactText,
  namedAssets,
  pictureFactText,
  cardLine,
  briefLook,
};
