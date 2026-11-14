'use strict';

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[。！？!?；;\n])/)
    .map(item => item.trim())
    .filter(Boolean);
}

function nameAt(sentence, name, others) {
  const source = String(sentence || '');
  const target = String(name || '').trim();
  if (!target) return -1;
  const longer = (others || [])
    .map(item => String(item || '').trim())
    .filter(item => item && item !== target && item.length > target.length && item.includes(target));
  let from = 0;
  while (from < source.length) {
    const at = source.indexOf(target, from);
    if (at < 0) return -1;
    const inside = longer.some(other => {
      const start = Math.max(0, at - (other.length - target.length));
      const window = source.slice(start, at + target.length + other.length);
      const rel = window.indexOf(other);
      if (rel < 0) return false;
      const abs = start + rel;
      return at >= abs && at < abs + other.length;
    });
    if (!inside) return at;
    from = at + target.length;
  }
  return -1;
}

function clipSentence(sentence, name, others) {
  const source = String(sentence || '').trim();
  const at = nameAt(source, name, others);
  if (at < 0) return '';
  const target = String(name || '').trim();
  let start = 0;
  let end = source.length;
  (others || []).forEach(raw => {
    const other = String(raw || '').trim();
    if (!other || other === target) return;
    let from = 0;
    while (from < source.length) {
      const pos = nameAt(source.slice(from), other, [ target, ...(others || []) ]) ;
      if (pos < 0) break;
      const abs = from + pos;
      if (abs + other.length <= at) start = Math.max(start, abs + other.length);
      else if (abs >= at + target.length) end = Math.min(end, abs);
      from = abs + other.length;
    }
  });
  return source.slice(start, end).replace(/^[，,、：:\s]+|[，,、：:\s]+$/g, '').trim();
}

function passages(text, name, others) {
  const chunks = [];
  const seen = new Set();
  splitSentences(text).forEach(sentence => {
    const clip = clipSentence(sentence, name, others);
    if (!clip || seen.has(clip)) return;
    seen.add(clip);
    chunks.push(clip);
  });
  return chunks.join('\n');
}

function mentionsOther(text, name, others) {
  return (others || []).some(other => nameAt(text, other, [ name, ...(others || []).filter(item => item !== other) ]) >= 0);
}

function keepOwn(text, name, others) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (!mentionsOther(raw, name, others)) return raw;
  return passages(raw, name, others);
}

function ownPassage({ name, look, note, body, others }) {
  const target = String(name || '').trim();
  const names = (others || []).map(item => String(item || '').trim()).filter(item => item && item !== target);
  const lines = [];
  const seen = new Set();
  [ keepOwn(look, target, names), keepOwn(note, target, names), passages(body, target, names) ]
    .join('\n')
    .split('\n')
    .forEach(line => {
      const text = line.trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      lines.push(text);
    });
  return lines.join('\n').slice(0, 1500);
}

function sceneIsSparse(name, look) {
  const bare = String(look || '').split(String(name || '').trim()).join('').replace(/\s+/g, '');
  return bare.length < 24;
}

function polishSheetPrompt(text) {
  return String(text || '').replace(/([黄白黑红棕褐蓝绿灰紫金银])色的?眼睛/g, '$1色眼眸');
}

module.exports = {
  nameAt,
  clipSentence,
  passages,
  ownPassage,
  sceneIsSparse,
  polishSheetPrompt,
};
