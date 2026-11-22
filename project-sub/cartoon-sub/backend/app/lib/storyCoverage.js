'use strict';

/** 只给镜头条数下限，不设上限。场次不使用这档。 */
function minStoryUnits(charCount) {
  const n = Math.max(0, Number(charCount) || 0);
  if (n < 800) return 1;
  if (n < 2000) return 2;
  if (n < 4000) return 4;
  if (n < 8000) return 6;
  if (n < 12000) return 8;
  return 8 + Math.ceil((n - 12000) / 2000);
}

function normalizeOmissions(value) {
  if (!Array.isArray(value)) return [];
  const list = [];
  for (const item of value) {
    const target = String(item?.target || item?.title || '').trim();
    const reason = String(item?.reason || '').trim();
    if (!reason) continue;
    const notice = String(item?.notice || '').trim();
    list.push(notice ? { target, reason, notice } : { target, reason });
  }
  return list;
}

const CN_DIGIT = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function chineseNumber(token) {
  const text = String(token || '').trim();
  if (/^\d+$/.test(text)) return Number(text);
  if (text === '十') return 10;
  const ten = text.indexOf('十');
  if (ten >= 0) {
    const high = ten === 0 ? 1 : (CN_DIGIT[text.slice(0, ten)] || 0);
    const low = CN_DIGIT[text.slice(ten + 1)] || 0;
    return high * 10 + low;
  }
  return CN_DIGIT[text] || 0;
}

function sceneNumbersIn(text) {
  const found = [];
  const source = String(text || '');
  const re = /第\s*([0-9]{1,3}|[一二三四五六七八九十]{1,3})\s*场/g;
  let match = re.exec(source);
  while (match) {
    const n = chineseNumber(match[1]);
    if (n > 0 && !found.includes(n)) found.push(n);
    match = re.exec(source);
  }
  const sceneRe = /(?:Scene|场次|场景)\s*([0-9]{1,3})/gi;
  match = sceneRe.exec(source);
  while (match) {
    const n = Number(match[1]);
    if (n > 0 && !found.includes(n)) found.push(n);
    match = sceneRe.exec(source);
  }
  return found;
}

/**
 * 一场可以对应多条镜头。一条镜头写到多场时，这几场都算留住，不把后面的场记成丢掉。
 */
function uncoveredScenes(scenes, shots) {
  const list = Array.isArray(scenes) ? scenes : [];
  const owned = new Set();
  for (const shot of shots || []) {
    const fromField = Number(shot?.scene_index);
    const fromText = sceneNumbersIn(shot?.description || shot?.coverage || '');
    const numbers = Number.isInteger(fromField) && fromField > 0 ? [ fromField, ...fromText ] : fromText;
    numbers.forEach(n => {
      if (!owned.has(n)) owned.add(n);
    });
  }
  return list.map((scene, index) => ({
    index: index + 1,
    title: String(scene?.title || '').replace(/^Scene\s*\d+\s*[:：]\s*/i, '').trim(),
  })).filter(scene => !owned.has(scene.index));
}

function quotedLines(text) {
  const lines = [];
  const source = String(text || '');
  const re = /[「“"]([^」”"]+)[」”"]/g;
  let match;
  while ((match = re.exec(source))) {
    const line = String(match[1] || '').replace(/\s+/g, '').trim();
    if (line) lines.push(line);
  }
  return lines;
}

function listedIndexes(shot) {
  const raw = Array.isArray(shot?.source_indexes)
    ? shot.source_indexes
    : String(shot?.source_indexes || '').split(/[,，、\s]+/);
  const list = [];
  raw.forEach(item => {
    const n = Number(item);
    if (Number.isInteger(n) && n > 0 && !list.includes(n)) list.push(n);
  });
  return list;
}

function compactText(text) {
  return String(text || '').replace(/\s+/g, '').replace(/[。！？!?，,、；;：:「」“”"'‘’]/g, '');
}

function shotBlob(shots) {
  return compactText((Array.isArray(shots) ? shots : [])
    .map(shot => [ shot?.dialogue, shot?.coverage, shot?.description ].filter(Boolean).join('\n'))
    .join('\n'));
}

/** 这场原文里还没有进镜头的段落。带对白的段必须能在对白或描述里找到原句。 */
function uncoveredParagraphs(paragraphs, shots) {
  const list = Array.isArray(paragraphs) ? paragraphs : [];
  const rows = Array.isArray(shots) ? shots : [];
  const blob = shotBlob(rows);
  const indexed = new Set();
  rows.forEach(shot => listedIndexes(shot).forEach(n => indexed.add(n)));
  return list.filter(paragraph => {
    const index = Number(paragraph?.index);
    const text = String(paragraph?.text || '');
    const quotes = quotedLines(text).map(compactText).filter(line => line.length >= 2);
    const flat = compactText(text);
    if (quotes.length) return !quotes.every(line => blob.includes(line));
    if (indexed.has(index)) return false;
    const needle = flat.slice(0, 12);
    return !(needle.length >= 6 && blob.includes(needle));
  }).map(paragraph => Number(paragraph.index)).filter(n => n > 0);
}

function skipExcuse(reason) {
  return /镜头够|镜头数|合理范围|已经演过|核心已|未继续拆|不再拆|整段不拆|够了/.test(String(reason || ''));
}

module.exports = {
  minStoryUnits,
  normalizeOmissions,
  sceneNumbersIn,
  uncoveredScenes,
  quotedLines,
  uncoveredParagraphs,
  skipExcuse,
};
