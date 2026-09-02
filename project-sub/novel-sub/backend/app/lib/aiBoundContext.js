'use strict';

const ID_KEYS = [
  'genre_path',
  'genre_category_id',
  'genre_subcategory_id',
  'theme_ids',
  'length_id',
  'audience_id',
  'update_pace_id',
];

function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  if (Array.isArray(value) && !value.length) return true;
  return false;
}

function findById(list, id) {
  if (id == null || id === '') return null;
  return (list || []).find((item) => String(item.id) === String(id)) || null;
}

function findGenreSub(genres, subId) {
  if (subId == null || subId === '') return null;
  for (const cat of genres || []) {
    const hit = findById(cat.children, subId);
    if (hit) return { cat, sub: hit };
  }
  return null;
}

function themeNamesFrom(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? item : item?.name))
    .map((name) => String(name || '').trim())
    .filter(Boolean);
}

function looksLikeBasic(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return ID_KEYS.some((key) => Object.prototype.hasOwnProperty.call(obj, key));
}

function fillGaps(target, source) {
  const next = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (isEmpty(next[key]) && !isEmpty(value)) next[key] = value;
  }
  return next;
}

function novelToBasicSource(novel = {}) {
  return {
    title: novel.title || '',
    creative_intent: novel.creative_intent || '',
    summary: novel.summary || '',
    genre: novel.genre || '',
    genre_subcategory: novel.genre_subcategory || '',
    themes: themeNamesFrom(novel.themes),
    theme_ids: Array.isArray(novel.theme_ids) ? novel.theme_ids : [],
    novel_type: novel.novel_type || '',
    target_audience: novel.target_audience || '',
    update_cadence: novel.update_cadence || '',
    genre_category_id: novel.genre_category_id || null,
    genre_subcategory_id: novel.genre_subcategory_id || null,
    length_id: novel.length_id || null,
    audience_id: novel.audience_id || null,
    update_pace_id: novel.update_pace_id || null,
  };
}

function hydrateBasicBlock(raw, catalog) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const next = { ...raw };
  const genres = catalog?.genres || [];
  const [pathCat, pathSub] = Array.isArray(next.genre_path) ? next.genre_path : [];
  const catId = next.genre_category_id || pathCat;
  const subId = next.genre_subcategory_id || pathSub;
  const cat = findById(genres, catId);
  const nested = findGenreSub(genres, subId);
  const sub = cat ? findById(cat.children, subId) : nested?.sub;

  if (isEmpty(next.genre) && cat?.name) next.genre = cat.name;
  if (isEmpty(next.genre) && nested?.cat?.name) next.genre = nested.cat.name;
  if (isEmpty(next.genre_subcategory) && sub?.name) next.genre_subcategory = sub.name;

  const genreLabel = [next.genre, next.genre_subcategory].filter((item) => !isEmpty(item)).join(' / ');
  if (genreLabel) next.genre_label = genreLabel;

  const namesFromIds = (Array.isArray(next.theme_ids) ? next.theme_ids : [])
    .map((id) => findById(catalog?.themes, id)?.name)
    .filter(Boolean);
  const themeNames = [...new Set([...themeNamesFrom(next.themes), ...namesFromIds])];
  if (themeNames.length) next.themes = themeNames;

  const length = findById(catalog?.lengths, next.length_id);
  if (length) {
    next.length = {
      name: length.name,
      min_words: length.min_words,
      max_words: length.max_words,
    };
    if (isEmpty(next.novel_type)) next.novel_type = length.name;
  }

  const audience = findById(catalog?.audiences, next.audience_id);
  if (audience && isEmpty(next.target_audience)) next.target_audience = audience.name;

  const pace = findById(catalog?.update_paces, next.update_pace_id);
  if (pace && isEmpty(next.update_cadence)) next.update_cadence = pace.name;

  if (!isEmpty(next.genre) || !isEmpty(next.genre_subcategory)) {
    delete next.genre_path;
    delete next.genre_category_id;
    delete next.genre_subcategory_id;
  }
  if (themeNames.length) delete next.theme_ids;
  if (next.length) delete next.length_id;
  if (!isEmpty(next.target_audience)) delete next.audience_id;
  if (!isEmpty(next.update_cadence)) delete next.update_pace_id;

  return next;
}

function mergeNovelIntoBoundContext(bound, novel) {
  if (!novel) return bound && typeof bound === 'object' ? { ...bound } : {};
  const fromNovel = novelToBasicSource(novel);
  const next = bound && typeof bound === 'object' ? { ...bound } : {};
  if (next.basic && typeof next.basic === 'object') {
    next.basic = fillGaps(next.basic, fromNovel);
    return next;
  }
  if (looksLikeBasic(next)) {
    return fillGaps(next, fromNovel);
  }
  if (!isEmpty(fromNovel.title) || !isEmpty(fromNovel.genre) || fromNovel.theme_ids.length) {
    next.basic = fromNovel;
  }
  return next;
}

function hydrateBoundContext(raw, catalog) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw || {};
  const next = { ...raw };
  if (next.basic && typeof next.basic === 'object' && !Array.isArray(next.basic)) {
    next.basic = hydrateBasicBlock(next.basic, catalog);
  }
  if (looksLikeBasic(next)) {
    Object.assign(next, hydrateBasicBlock(next, catalog));
  }
  return next;
}

function pickLengthId(bound) {
  return bound?.basic?.length_id || bound?.length_id || null;
}

function addLabel(labels, cond, label) {
  if (cond && !labels.includes(label)) labels.push(label);
}

function collectContextLabels(bound = {}) {
  const basic = bound.basic && typeof bound.basic === 'object' ? bound.basic : {};
  const world = bound.world && typeof bound.world === 'object' ? bound.world : {};
  const labels = [];
  addLabel(labels, !isEmpty(basic.title || bound.title), '小说名称');
  addLabel(labels, !isEmpty(basic.creative_intent || bound.creative_intent), '小说立意');
  addLabel(labels, !isEmpty(basic.summary || bound.summary), '小说简介');
  addLabel(labels, !isEmpty(basic.genre || basic.genre_label || basic.genre_subcategory || bound.genre), '小说类型');
  addLabel(labels, !isEmpty(basic.themes || bound.themes), '题材');
  addLabel(labels, !isEmpty(basic.novel_type || basic.length || bound.novel_type), '篇幅');
  addLabel(labels, !isEmpty(basic.target_audience || bound.target_audience), '目标读者');
  addLabel(labels, !isEmpty(basic.update_cadence || bound.update_cadence), '更新节奏');
  addLabel(labels, !isEmpty(bound.era || world.era), '时代背景');
  addLabel(labels, !isEmpty(bound.geography || world.geography), '地理环境');
  addLabel(labels, !isEmpty(bound.social_rules || world.social_rules), '社会规则');
  addLabel(labels, !isEmpty(bound.power_system || world.power_system), '力量体系');
  addLabel(labels, !isEmpty(bound.technology || world.technology), '科技水平');
  addLabel(labels, !isEmpty(bound.history_notes || world.history_notes), '历史概览');
  addLabel(labels, !isEmpty(bound.timeline || world.timeline), '时间轴');
  addLabel(labels, !isEmpty(bound.factions), '门派组织');
  addLabel(labels, !isEmpty(bound.characters), '人物');
  addLabel(labels, !isEmpty(bound.character_edges), '人物关系');
  addLabel(labels, !isEmpty(bound.body || bound.body_excerpt || bound.chapter), '本章正文');
  addLabel(labels, !isEmpty(bound.prev_chapter?.ending || bound.prev_ending), '上一章结尾');
  addLabel(labels, !isEmpty(bound.next_outline), '下一章钩子');
  addLabel(labels, bound.word_target != null && bound.word_target !== '', '目标字数');
  addLabel(labels, !isEmpty(bound.volumes), '大纲');
  addLabel(labels, !isEmpty(bound.chapters), '章节');
  addLabel(labels, !isEmpty(bound.outline_titles), '大纲小节');
  return labels;
}

function slimCatalogForAgent(catalog = {}) {
  return {
    genres: (catalog.genres || []).map((cat) => ({
      name: cat.name,
      children: (cat.children || []).map((child) => child.name),
    })),
    themes: (catalog.themes || []).map((item) => item.name),
    audiences: (catalog.audiences || []).map((item) => item.name),
    lengths: (catalog.lengths || []).map((item) => ({
      name: item.name,
      min_words: item.min_words,
      max_words: item.max_words,
    })),
    update_paces: (catalog.update_paces || []).map((item) => item.name),
  };
}

module.exports = {
  hydrateBoundContext,
  mergeNovelIntoBoundContext,
  pickLengthId,
  slimCatalogForAgent,
  collectContextLabels,
};
