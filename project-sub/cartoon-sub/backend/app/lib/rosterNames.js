'use strict';

const KINSHIP = new Set([
  '大姨', '阿姨', '小姨', '舅舅', '姑姑', '叔叔', '伯伯', '伯母', '姨妈', '姨父',
  '爷爷', '奶奶', '外公', '外婆', '姥姥', '姥爷',
  '爸爸', '妈妈', '父亲', '母亲', '爹', '娘',
  '哥哥', '姐姐', '弟弟', '妹妹',
  '表哥', '表姐', '表弟', '表妹', '堂哥', '堂姐', '堂弟', '堂妹',
  '嫂子', '姐夫', '弟媳', '丈夫', '妻子', '老公', '老婆',
  '儿子', '女儿', '孙子', '孙女', '侄子', '侄女', '外甥', '外甥女',
  '婆婆', '公公',
]);

function isKinship(value) {
  return KINSHIP.has(String(value || '').trim());
}

function characterTag(raw) {
  const text = String(raw || '').trim();
  const matched = text.match(/^(.+?)[（(](.+?)[）)]$/);
  if (!matched) return { name: text, note: '' };
  const left = matched[1].trim();
  const right = matched[2].trim();
  const leftKin = isKinship(left);
  const rightKin = isKinship(right);
  if (!leftKin && rightKin) return { name: left, note: right };
  if (leftKin && !rightKin) return { name: right, note: left };
  if (leftKin) return { name: left, note: '' };
  return { name: left, note: right };
}

function placeTag(raw) {
  let text = String(raw || '').trim();
  text = text.replace(/^第\s*\d+\s*场(补充)?[：:]\s*/, '');
  const cut = text.split(/\s*[-—–－]\s*/)[0].trim();
  return cut || text;
}

function normalizeScript(script) {
  const data = script && typeof script === 'object' ? { ...script } : {};
  const characters = (Array.isArray(data.characters) ? data.characters : []).map(item => {
    const source = typeof item === 'string' ? { name: item } : (item || {});
    const tag = characterTag(source.name);
    if (!tag.name) return null;
    const look = String(source.look || '').trim();
    const identity = tag.note && !look.includes(tag.note) ? `身份：${tag.note}` : '';
    return {
      ...source,
      name: tag.name,
      look: [ look, identity ].filter(Boolean).join(' '),
    };
  }).filter(Boolean);
  const scenes = (Array.isArray(data.scenes) ? data.scenes : []).map(scene => ({
    ...scene,
    title: placeTag(scene?.title || scene?.name),
  }));
  const seen = new Set();
  const places = [];
  scenes.forEach(scene => {
    const name = placeTag(scene.title);
    if (!name || seen.has(name)) return;
    seen.add(name);
    places.push({ name, note: '' });
  });
  return { ...data, characters, scenes, places };
}

module.exports = {
  characterTag,
  placeTag,
  normalizeScript,
};
