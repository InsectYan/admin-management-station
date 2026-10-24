'use strict';

const { stylePreset } = require('./stylePresets');

const CHARACTER_FIELDS = [ 'age', 'identity', 'appearance', 'language_style', 'arc' ];

function text(value) {
  return String(value || '').trim();
}

function characterCard(row) {
  const name = text(row?.name);
  if (!name) return null;
  const card = { name };
  const id = text(row?.id);
  if (id) card.id = id;
  const values = {
    age: row?.age,
    identity: row?.identity,
    appearance: row?.appearance,
    language_style: row?.speech_style || row?.language_style,
    arc: row?.arc,
  };
  CHARACTER_FIELDS.forEach(key => {
    if (text(values[key])) card[key] = text(values[key]);
  });
  return card;
}

function termCards(rows) {
  return (rows || []).map(row => {
    const plain = row?.toJSON ? row.toJSON() : row;
    const name = text(plain?.name);
    if (!name || plain?.status === 'archived') return null;
    const aliases = Array.isArray(plain.aliases) ? plain.aliases.map(item => text(item)).filter(Boolean) : [];
    return {
      name,
      aliases,
      definition: text(plain.definition),
      category: text(plain.category) || 'term',
    };
  }).filter(Boolean);
}

function mergeCharacters(existing, cards) {
  if (!cards.length) return existing;
  if (!Array.isArray(existing) || !existing.length) return cards;
  const byName = new Map(cards.map(item => [ item.name, item ]));
  return existing.map(item => {
    const card = byName.get(text(item?.name));
    if (!card) return item;
    const next = { ...item };
    CHARACTER_FIELDS.forEach(key => {
      if (!text(next[key]) && card[key]) next[key] = card[key];
    });
    return next;
  });
}

function limitChapters(chapters, currentId) {
  const list = Array.isArray(chapters) ? chapters : [];
  if (!list.length) return list;
  const wanted = text(currentId);
  if (!wanted) return list.length === 1 ? list : [];
  const index = list.findIndex(item => text(item?.id || item?.chapter_id) === wanted);
  if (index < 0) {
    const current = list.find(item => text(item?.chapter_id) === wanted || text(item?.id) === wanted);
    return current ? [ current ] : [];
  }
  return list.slice(Math.max(0, index - 1), index + 2);
}

function enrichWriterContext(bound, { novel, terms, characters, feature, chapterId } = {}) {
  const next = bound && typeof bound === 'object' ? { ...bound } : {};
  const preset = stylePreset(novel?.style_preset);
  if (preset) {
    next.style_preset = { id: preset.id, name: preset.name, note: preset.note };
    if (!next.style) next.style = { id: preset.id, name: preset.name, note: preset.note };
  } else {
    delete next.style_preset;
  }
  const termList = termCards(terms);
  if (termList.length) next.terms = termList;
  else delete next.terms;
  const cards = (characters || novel?.setting_json?.characters || []).map(characterCard).filter(Boolean);
  if (cards.length || Array.isArray(next.characters)) next.characters = mergeCharacters(next.characters, cards);
  if (feature === 'chapter') {
    const current = chapterId || next.chapter?.id || next.chapter_id;
    next.chapters = limitChapters(next.chapters, current);
  }
  return next;
}

module.exports = { enrichWriterContext, limitChapters, termCards, characterCard };
