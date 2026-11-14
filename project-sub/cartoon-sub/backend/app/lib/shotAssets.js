'use strict';

const { characterTag, placeTag } = require('./rosterNames');

const VISUAL_KINDS = [ 'character', 'scene', 'prop' ];

function cleanName(value) {
  return String(value || '').trim();
}

function pushName(list, seen, item) {
  const name = cleanName(item.name);
  const min = item.asset_id ? 1 : 2;
  if (name.length < min || seen.has(name)) return;
  seen.add(name);
  list.push({
    name,
    kind: item.kind || 'character',
    asset_id: item.asset_id || null,
  });
}

function catalogOf(assets, script) {
  const list = [];
  const seen = new Set();
  (assets || []).forEach(asset => {
    if (asset.disabled || !VISUAL_KINDS.includes(asset.kind)) return;
    pushName(list, seen, { name: asset.name, kind: asset.kind, asset_id: asset.id });
  });
  const data = script || {};
  (data.characters || []).forEach(item => {
    const raw = typeof item === 'string' ? item : item?.name;
    pushName(list, seen, { name: characterTag(raw).name, kind: 'character' });
  });
  (data.places || []).forEach(item => {
    const raw = typeof item === 'string' ? item : item?.name;
    pushName(list, seen, { name: placeTag(raw), kind: 'scene' });
  });
  (data.scenes || []).forEach(item => {
    pushName(list, seen, { name: placeTag(item?.place || item?.title || item?.name), kind: 'scene' });
  });
  return list.sort((a, b) => b.name.length - a.name.length);
}

function findMentions(text, catalog) {
  const source = String(text || '');
  const occupied = [];
  const found = [];
  catalog.forEach(item => {
    let from = 0;
    while (from < source.length) {
      const at = source.indexOf(item.name, from);
      if (at < 0) break;
      const end = at + item.name.length;
      const overlap = occupied.some(span => at < span.end && end > span.start);
      if (!overlap) {
        occupied.push({ start: at, end });
        found.push(item);
        break;
      }
      from = at + 1;
    }
  });
  return found;
}

function shotText(parts) {
  return [ parts.description, parts.dialogue, parts.positive_zh, parts.frame_start_zh, parts.frame_end_zh, parts.negative_zh ]
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join('\n');
}

function auditShot({ text, assets, script, boundIds }) {
  const bound = new Set((boundIds || []).map(id => Number(id)).filter(id => id > 0));
  const mentioned = findMentions(text, catalogOf(assets, script));
  const seen = new Set();
  const marks = [];
  mentioned.forEach(item => {
    seen.add(item.name);
    const linked = item.asset_id && bound.has(Number(item.asset_id));
    marks.push({
      name: item.name,
      kind: item.kind,
      asset_id: item.asset_id || null,
      state: linked ? 'have' : 'miss',
    });
  });
  (assets || []).forEach(asset => {
    if (asset.disabled || !VISUAL_KINDS.includes(asset.kind) || !bound.has(Number(asset.id))) return;
    if (seen.has(asset.name)) return;
    marks.push({
      name: asset.name,
      kind: asset.kind,
      asset_id: asset.id,
      state: 'have',
    });
  });
  return marks;
}

function mentionedAssetIds(text, assets) {
  return findMentions(text, catalogOf(assets, {}))
    .map(item => item.asset_id)
    .filter(id => id);
}

module.exports = {
  catalogOf,
  findMentions,
  shotText,
  auditShot,
  mentionedAssetIds,
};
