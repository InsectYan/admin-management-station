import {
  createChapterItem,
  createCharacter,
  createCharacterEdge,
  createFaction,
  createOutlineGroup,
  createOutlineSection,
  createOutlineVolume,
  createTimelineNode,
} from './novelCreateSchema.js';

export function applyBasicPatch(form, patch = {}) {
  if (!form || !patch || typeof patch !== 'object') return;
  if (patch.title !== undefined) form.title = String(patch.title);
  if (patch.creative_intent !== undefined) form.creative_intent = String(patch.creative_intent);
  if (patch.summary !== undefined) form.summary = String(patch.summary);
}

const WORLD_TEXT_KEYS = [
  'era',
  'geography',
  'social_rules',
  'power_system',
  'technology',
  'history_notes',
];

function timelineKey(node) {
  return `${String(node?.year || '').trim()}|${String(node?.event || '').trim()}`;
}

export function applyWorldPatch(form, patch = {}) {
  if (!form || !patch || typeof patch !== 'object') return;
  for (const key of WORLD_TEXT_KEYS) {
    if (patch[key] !== undefined) form[key] = String(patch[key]);
  }
  if (!Array.isArray(patch.timeline)) return;
  if (!Array.isArray(form.timeline)) form.timeline = [];
  const seen = new Set(form.timeline.map(timelineKey));
  for (const item of patch.timeline) {
    const year = String(item?.year || '').trim();
    const event = String(item?.event || '').trim();
    if (!year && !event) continue;
    const key = `${year}|${event}`;
    if (seen.has(key)) continue;
    seen.add(key);
    form.timeline.push(createTimelineNode({ year, event }));
  }
}

const CHAR_NESTED_RE = /^characters\[([^\]]+)\]\.(name|role|personality|background|goal|relations)$/;

function isCharacterNestedPath(path) {
  return CHAR_NESTED_RE.test(String(path || ''));
}

export function applyCharacterPatch(characters, edges, patch = {}, options = {}) {
  if (!Array.isArray(characters) || !patch || typeof patch !== 'object') return;
  const paths = Array.isArray(options.paths) ? options.paths : [];
  const allowCast = !paths.length
    || paths.includes('characters')
    || paths.some(isCharacterNestedPath);
  const allowEdges = !paths.length || paths.includes('character_edges');
  const nestedOnly = paths.length > 0 && paths.every(isCharacterNestedPath);

  if (allowCast && Array.isArray(patch.characters)) {
    for (const incoming of patch.characters) {
      const name = String(incoming?.name || '').trim();
      if (!name && !incoming?.id) continue;
      const existing = characters.find((row) => (
        (incoming.id && row.id === incoming.id) || (name && row.name === name)
      ));
      if (existing) {
        if (incoming.role) existing.role = incoming.role;
        if (incoming.faction_id !== undefined) existing.faction_id = String(incoming.faction_id || '');
        for (const key of ['name', 'personality', 'background', 'goal', 'relations']) {
          if (incoming[key] !== undefined) existing[key] = String(incoming[key]);
        }
        continue;
      }
      if (nestedOnly) continue;
      characters.push(createCharacter(incoming));
    }
  }

  if (!allowEdges || !Array.isArray(patch.character_edges) || !Array.isArray(edges)) return;

  const resolve = (ref) => {
    const token = String(ref || '').trim();
    if (!token) return '';
    const byId = characters.find((row) => row.id === token);
    if (byId) return byId.id;
    const byName = characters.find((row) => row.name === token);
    return byName?.id || '';
  };

  for (const row of patch.character_edges) {
    const source = resolve(row.source);
    const target = resolve(row.target);
    if (!source || !target || source === target) continue;
    const relation = row.relation || 'ally';
    const dup = edges.find((edge) => (
      edge.source === source && edge.target === target && edge.relation === relation
    ));
    if (dup) {
      if (row.label) dup.label = String(row.label);
      continue;
    }
    edges.push(createCharacterEdge({
      source,
      target,
      relation,
      label: row.label || '',
    }));
  }
}

export function applyFactionPatch(factions, patch = {}, options = {}) {
  if (!Array.isArray(factions) || !patch || typeof patch !== 'object') return;
  const incoming = Array.isArray(patch.factions) ? patch.factions : [];
  if (!incoming.length) return;
  const characters = Array.isArray(options.characters) ? options.characters : [];
  const resolveMember = (ref) => {
    const token = String(ref || '').trim();
    if (!token) return '';
    const byId = characters.find((row) => row.id === token);
    if (byId) return byId.id;
    const byName = characters.find((row) => row.name === token);
    return byName?.id || token;
  };

  for (const row of incoming) {
    const name = String(row?.name || '').trim();
    if (!name && !row?.id) continue;
    const hit = factions.find((item) => (
      (row.id && item.id === row.id) || (name && item.name === name)
    ));
    const memberIds = Array.isArray(row.member_ids)
      ? row.member_ids.map(resolveMember).filter(Boolean)
      : undefined;
    if (hit) {
      if (row.name) hit.name = name;
      if (row.kind) hit.kind = row.kind;
      if (row.alignment) hit.alignment = row.alignment;
      for (const key of ['description', 'rules', 'headquarters']) {
        if (row[key] !== undefined) hit[key] = String(row[key]);
      }
      if (memberIds) hit.member_ids = memberIds;
      continue;
    }
    factions.push(createFaction({
      ...row,
      name,
      member_ids: memberIds || [],
    }));
  }
}

function findOutlineNode(list, incoming) {
  if (!incoming) return null;
  return (list || []).find((row) => (
    (incoming.id && row.id === incoming.id) || (incoming.title && row.title === incoming.title)
  )) || null;
}

function applyWordTargets(existingList, incomingList) {
  for (const incoming of incomingList || []) {
    const hit = findOutlineNode(existingList, incoming);
    if (!hit) continue;
    if (incoming.word_target !== undefined) hit.word_target = Number(incoming.word_target) || 0;
    if (hit.groups && incoming.groups) applyWordTargets(hit.groups, incoming.groups);
    if (hit.sections && incoming.sections) applyWordTargets(hit.sections, incoming.sections);
  }
}

function mergeOutlineSection(existing, incoming) {
  if (incoming.title) existing.title = incoming.title;
  if (incoming.word_target !== undefined) existing.word_target = Number(incoming.word_target) || 0;
}

function mergeOutlineGroup(existing, incoming) {
  if (incoming.title) existing.title = incoming.title;
  if (incoming.word_target !== undefined) existing.word_target = Number(incoming.word_target) || 0;
  if (!Array.isArray(incoming.sections)) return;
  if (!Array.isArray(existing.sections)) existing.sections = [];
  for (const sec of incoming.sections) {
    const hit = findOutlineNode(existing.sections, sec);
    if (hit) mergeOutlineSection(hit, sec);
    else existing.sections.push(createOutlineSection(sec));
  }
}

function mergeOutlineVolume(existing, incoming) {
  if (incoming.title) existing.title = incoming.title;
  if (incoming.word_target !== undefined) existing.word_target = Number(incoming.word_target) || 0;
  if (!Array.isArray(incoming.groups)) return;
  if (!Array.isArray(existing.groups)) existing.groups = [];
  for (const group of incoming.groups) {
    const hit = findOutlineNode(existing.groups, group);
    if (hit) mergeOutlineGroup(hit, group);
    else existing.groups.push(createOutlineGroup(group));
  }
}

export function applyOutlinePatch(form, patch = {}, options = {}) {
  if (!form || !patch || typeof patch !== 'object') return;
  const incoming = Array.isArray(patch.volumes) ? patch.volumes : [];
  if (!incoming.length) return;
  if (!Array.isArray(form.volumes)) form.volumes = [];
  const paths = Array.isArray(options.paths) ? options.paths : [];
  const allowStruct = !paths.length || paths.includes('volumes');
  const allowWords = !paths.length || paths.includes('word_targets');

  if (!form.volumes.length) {
    incoming.forEach((vol) => form.volumes.push(createOutlineVolume(vol)));
    return;
  }
  if (allowStruct) {
    for (const vol of incoming) {
      const hit = findOutlineNode(form.volumes, vol);
      if (hit) mergeOutlineVolume(hit, vol);
      else form.volumes.push(createOutlineVolume(vol));
    }
    return;
  }
  if (allowWords) applyWordTargets(form.volumes, incoming);
}

function findChapter(list, incoming) {
  if (!incoming) return null;
  return (list || []).find((row) => (
    (incoming.id && row.id === incoming.id) || (incoming.title && row.title === incoming.title)
  )) || null;
}

export function flattenOutlineTitles(volumes = []) {
  const rows = [];
  for (const vol of volumes || []) {
    if (vol?.title) rows.push({ id: vol.id, title: vol.title });
    for (const group of vol?.groups || []) {
      if (group?.title) rows.push({ id: group.id, title: group.title });
      for (const sec of group?.sections || []) {
        if (sec?.title) rows.push({ id: sec.id, title: sec.title });
      }
    }
  }
  return rows;
}

export function applyChaptersPatch(form, patch = {}, options = {}) {
  if (!form || !patch || typeof patch !== 'object') return;
  const incoming = Array.isArray(patch.chapters) ? patch.chapters : [];
  if (!incoming.length) return;
  if (!Array.isArray(form.chapters)) form.chapters = [];
  const paths = Array.isArray(options.paths) ? options.paths : [];
  const allowTitle = !paths.length || paths.includes('chapters');
  const allowFaction = !paths.length || paths.includes('chapters') || paths.includes('faction');
  const allowRef = !paths.length || paths.includes('chapters') || paths.includes('outline_ref');
  const appendNew = allowTitle;

  for (const ch of incoming) {
    const hit = findChapter(form.chapters, ch);
    if (hit) {
      if (allowTitle && ch.title) hit.title = String(ch.title);
      if (allowFaction && ch.faction) hit.faction = ch.faction;
      if (allowRef && ch.outline_ref !== undefined) hit.outline_ref = String(ch.outline_ref);
      continue;
    }
    if (!appendNew) continue;
    form.chapters.push(createChapterItem({
      title: ch.title,
      faction: ch.faction,
      outline_ref: ch.outline_ref,
      order: form.chapters.length + 1,
    }));
  }
}


