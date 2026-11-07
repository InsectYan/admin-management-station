'use strict';

/** 只按字数给下限，不设上限。与剧本/分镜技能使用同一档。 */
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
    list.push({ target, reason });
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
 * 一场可以对应多条镜头。一条镜头若同时点了多场，只承认最先写到的那场，后面的场算被并掉。
 */
function uncoveredScenes(scenes, shots) {
  const list = Array.isArray(scenes) ? scenes : [];
  const owned = new Set();
  for (const shot of shots || []) {
    const fromField = Number(shot?.scene_index);
    const fromText = sceneNumbersIn(shot?.description || shot?.coverage || '');
    const numbers = Number.isInteger(fromField) && fromField > 0 ? [ fromField, ...fromText ] : fromText;
    const unique = numbers.filter((n, index) => numbers.indexOf(n) === index);
    if (unique.length >= 1) owned.add(unique[0]);
  }
  return list.map((scene, index) => ({
    index: index + 1,
    title: String(scene?.title || '').replace(/^Scene\s*\d+\s*[:：]\s*/i, '').trim(),
  })).filter(scene => !owned.has(scene.index));
}

module.exports = {
  minStoryUnits,
  normalizeOmissions,
  sceneNumbersIn,
  uncoveredScenes,
};
