'use strict';

const { sanitizeTasks } = require('./aiPlan');

const BASIC_FIELDS = ['title', 'creative_intent', 'summary'];
const WORLD_TEXT_FIELDS = [
  'era',
  'geography',
  'social_rules',
  'power_system',
  'technology',
  'history_notes',
];
const WORLD_FIELDS = [...WORLD_TEXT_FIELDS, 'timeline'];
const CHARACTER_LIST_FIELDS = ['characters', 'character_edges'];
const CHARACTER_ITEM_FIELDS = ['name', 'role', 'personality', 'background', 'goal', 'relations'];
const CHARACTER_SENTINEL = 'characters[]';
const CHARACTER_ROLES = new Set(['main', 'support', 'villain']);
const CHARACTER_RELATIONS = new Set(['ally', 'enemy', 'mentor', 'family', 'love']);
const OUTLINE_FIELDS = ['volumes', 'word_targets'];
const CHAPTER_FIELDS = ['chapters'];
const CHAPTER_SCENE_FIELDS = ['chapters', 'faction', 'outline_ref'];
const CHAPTER_FACTIONS = new Set(['hero', 'villain', 'neutral']);
const PLAN_FIELDS = ['tasks'];
const CHAR_NESTED_RE = /^characters\[([^\]]+)\]\.(name|role|personality|background|goal|relations)$/;
const GENERATABLE_FIELDS = [
  ...BASIC_FIELDS,
  ...WORLD_FIELDS,
  ...CHARACTER_LIST_FIELDS,
  ...OUTLINE_FIELDS,
  ...CHAPTER_SCENE_FIELDS,
  ...PLAN_FIELDS,
];

function slimCatalog(tree = {}) {
  return {
    genres: (tree.genres || []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      children: (cat.children || []).map((child) => ({ id: child.id, name: child.name })),
    })),
    themes: (tree.themes || []).map((item) => ({ id: item.id, name: item.name })),
    audiences: (tree.audiences || []).map((item) => ({ id: item.id, name: item.name })),
    lengths: (tree.lengths || []).map((item) => ({
      id: item.id,
      name: item.name,
      min_words: item.min_words,
      max_words: item.max_words,
    })),
    update_paces: (tree.update_paces || []).map((item) => ({ id: item.id, name: item.name })),
  };
}

function isCharacterNestedPath(key) {
  return CHAR_NESTED_RE.test(String(key || ''));
}

function filterGeneratableFields(fields) {
  return (Array.isArray(fields) ? fields : []).filter(
    (key) => GENERATABLE_FIELDS.includes(key) || isCharacterNestedPath(key),
  );
}

function fieldInSceneAllow(key, sceneAllow) {
  const allow = Array.isArray(sceneAllow) ? sceneAllow : [];
  if (allow.includes(key)) return true;
  if (
    isCharacterNestedPath(key)
    && (allow.includes('characters') || allow.includes(CHARACTER_SENTINEL))
  ) {
    return true;
  }
  return false;
}

function sanitizeTimeline(raw) {
  if (!Array.isArray(raw)) return undefined;
  const items = [];
  const seen = new Set();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const year = String(row.year || '').trim().slice(0, 80);
    const event = String(row.event || '').trim().slice(0, 800);
    if (!year && !event) continue;
    const key = `${year}|${event}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ year, event });
    if (items.length >= 20) break;
  }
  return items.length ? items : undefined;
}

function clipText(value, max) {
  const text = String(value == null ? '' : value).trim();
  return text ? text.slice(0, max) : '';
}

function sanitizeCharacter(row) {
  if (!row || typeof row !== 'object') return null;
  const name = clipText(row.name, 40);
  if (!name) return null;
  const out = { name };
  if (row.id) out.id = String(row.id).trim().slice(0, 64);
  out.role = CHARACTER_ROLES.has(row.role) ? row.role : 'support';
  for (const key of ['personality', 'background', 'goal', 'relations']) {
    if (row[key] === undefined || row[key] === null) continue;
    const text = clipText(row[key], 2000);
    if (text) out[key] = text;
  }
  return out;
}

function sanitizeEdges(raw, notices) {
  if (!Array.isArray(raw)) return undefined;
  const items = [];
  const seen = new Set();
  let dropped = 0;
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const source = clipText(row.source, 64);
    const target = clipText(row.target, 64);
    if (!source || !target || source === target) continue;
    if (row.relation && !CHARACTER_RELATIONS.has(row.relation)) {
      dropped += 1;
      continue;
    }
    const relation = CHARACTER_RELATIONS.has(row.relation) ? row.relation : 'ally';
    const key = `${source}|${target}|${relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = { source, target, relation };
    const label = clipText(row.label, 80);
    if (label) item.label = label;
    items.push(item);
    if (items.length >= 40) break;
  }
  if (dropped) notices.push(`已丢掉 ${dropped} 条非法人物关系（仅允许 ally/enemy/mentor/family/love）`);
  return items.length ? items : undefined;
}

function clipWordTarget(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return Math.min(Math.round(num), 5000000);
}

function sanitizeOutlineSection(row) {
  if (!row || typeof row !== 'object') return null;
  const title = clipText(row.title, 80);
  if (!title) return null;
  const out = { title };
  if (row.id) out.id = String(row.id).trim().slice(0, 64);
  const words = clipWordTarget(row.word_target);
  if (words !== undefined) out.word_target = words;
  return out;
}

function sanitizeOutlineGroup(row) {
  if (!row || typeof row !== 'object') return null;
  const title = clipText(row.title, 80);
  if (!title) return null;
  const out = { title };
  if (row.id) out.id = String(row.id).trim().slice(0, 64);
  const words = clipWordTarget(row.word_target);
  if (words !== undefined) out.word_target = words;
  const sections = (Array.isArray(row.sections) ? row.sections : [])
    .map(sanitizeOutlineSection)
    .filter(Boolean)
    .slice(0, 30);
  if (sections.length) out.sections = sections;
  return out;
}

function sanitizeOutlineVolume(row) {
  if (!row || typeof row !== 'object') return null;
  const title = clipText(row.title, 80);
  if (!title) return null;
  const out = { title };
  if (row.id) out.id = String(row.id).trim().slice(0, 64);
  const words = clipWordTarget(row.word_target);
  if (words !== undefined) out.word_target = words;
  const groups = (Array.isArray(row.groups) ? row.groups : [])
    .map(sanitizeOutlineGroup)
    .filter(Boolean)
    .slice(0, 20);
  if (groups.length) out.groups = groups;
  return out;
}

function sanitizeVolumes(raw) {
  if (!Array.isArray(raw)) return undefined;
  const list = raw.map(sanitizeOutlineVolume).filter(Boolean).slice(0, 12);
  return list.length ? list : undefined;
}

function countOutlineWords(volumes = []) {
  let total = 0;
  for (const vol of volumes) {
    total += Number(vol?.word_target) || 0;
    for (const group of vol?.groups || []) {
      total += Number(group?.word_target) || 0;
      for (const sec of group?.sections || []) {
        total += Number(sec?.word_target) || 0;
      }
    }
  }
  return total;
}

function sanitizeChapter(row, { allowTitle, allowFaction, allowRef }, dropCount) {
  if (!row || typeof row !== 'object') return null;
  const title = clipText(row.title, 80);
  const id = row.id ? String(row.id).trim().slice(0, 64) : '';
  if (!title && !id) return null;
  const out = {};
  if (id) out.id = id;
  if (title) out.title = title;
  if (allowFaction && row.faction !== undefined && row.faction !== null && String(row.faction).trim()) {
    if (CHAPTER_FACTIONS.has(row.faction)) {
      out.faction = row.faction;
    } else {
      dropCount.faction += 1;
    }
  }
  if (allowRef && row.outline_ref !== undefined) {
    const ref = clipText(row.outline_ref, 80);
    if (ref) out.outline_ref = ref;
  }
  if (!allowTitle && !out.faction && !out.outline_ref) return null;
  if (allowTitle && !title) return null;
  return out;
}

function sanitizeChapters(raw, allow, notices) {
  if (!Array.isArray(raw)) return undefined;
  const allowTitle = allow.has('chapters');
  const allowFaction = allow.has('chapters') || allow.has('faction');
  const allowRef = allow.has('chapters') || allow.has('outline_ref');
  const dropCount = { faction: 0 };
  const list = [];
  for (const row of raw) {
    const item = sanitizeChapter(row, { allowTitle, allowFaction, allowRef }, dropCount);
    if (!item) continue;
    list.push(item);
    if (list.length >= 40) break;
  }
  if (dropCount.faction) {
    notices.push(`已丢掉 ${dropCount.faction} 个非法阵营（仅允许 hero/villain/neutral）`);
  }
  return list.length ? list : undefined;
}

function outlineWordWarning(volumes, catalog, lengthId) {
  if (!Array.isArray(volumes) || !volumes.length || lengthId == null || lengthId === '') return '';
  const hit = (catalog?.lengths || []).find((item) => String(item.id) === String(lengthId));
  if (!hit) return '';
  const total = countOutlineWords(volumes);
  const min = Number(hit.min_words) || 0;
  const max = Number(hit.max_words) || 0;
  if (min && total < min) {
    return `规划字数 ${total.toLocaleString()} 低于篇幅「${hit.name}」下限 ${min.toLocaleString()}，可自行调整，不会自动改数字。`;
  }
  if (max && total > max) {
    return `规划字数 ${total.toLocaleString()} 超过篇幅「${hit.name}」上限 ${max.toLocaleString()}，可自行调整，不会自动改数字。`;
  }
  return '';
}

function nestedAllowMeta(allowedFields) {
  const nested = allowedFields.filter(isCharacterNestedPath);
  if (!nested.length) return null;
  const ids = new Set();
  const fields = new Set();
  for (const path of nested) {
    const match = path.match(CHAR_NESTED_RE);
    if (!match) continue;
    ids.add(match[1]);
    fields.add(match[2]);
  }
  return { ids, fields };
}

function sanitizePatch(raw, _catalog, allowedFields, notices = [], options = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const requested = allowedFields && allowedFields.length ? allowedFields : GENERATABLE_FIELDS;
  const allow = new Set(filterGeneratableFields(requested));
  const out = {};
  for (const key of [...BASIC_FIELDS, ...WORLD_TEXT_FIELDS]) {
    if (!allow.has(key) || source[key] === undefined || source[key] === null) continue;
    const text = String(source[key]).trim();
    if (text) out[key] = text.slice(0, key === 'title' ? 200 : 4000);
  }
  if (allow.has('timeline') && source.timeline !== undefined) {
    const timeline = sanitizeTimeline(source.timeline);
    if (timeline) out.timeline = timeline;
  }

  const allowCast = allow.has('characters') || [...allow].some(isCharacterNestedPath);
  if (allowCast && Array.isArray(source.characters)) {
    let list = source.characters.map(sanitizeCharacter).filter(Boolean).slice(0, 20);
    const nested = nestedAllowMeta([...allow]);
    if (nested && !allow.has('characters')) {
      list = list
        .filter((row) => nested.ids.has(row.id) || nested.ids.has(row.name))
        .map((row) => {
          const picked = {};
          if (row.id) picked.id = row.id;
          picked.name = row.name;
          for (const field of nested.fields) {
            if (row[field] !== undefined) picked[field] = row[field];
          }
          return picked;
        });
    }
    if (list.length) out.characters = list;
  }

  if (allow.has('character_edges') && source.character_edges !== undefined) {
    const edges = sanitizeEdges(source.character_edges, notices);
    if (edges) out.character_edges = edges;
  }

  const allowOutline = allow.has('volumes') || allow.has('word_targets');
  if (allowOutline) {
    const rawVolumes = Array.isArray(source.volumes)
      ? source.volumes
      : (source.outline && Array.isArray(source.outline.volumes) ? source.outline.volumes : null);
    const volumes = sanitizeVolumes(rawVolumes);
    if (volumes) out.volumes = volumes;
  }

  const allowChapters = allow.has('chapters') || allow.has('faction') || allow.has('outline_ref');
  if (allowChapters) {
    const chapters = sanitizeChapters(source.chapters, allow, notices);
    if (chapters) out.chapters = chapters;
  }

  if (allow.has('tasks')) {
    const coverage = options.coverage || {};
    const tasks = sanitizeTasks(source.tasks, coverage);
    if (tasks.length) out.tasks = tasks;
  }
  return out;
}

function extractBalancedObjects(text) {
  const src = String(text || '');
  const out = [];
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] !== '{') continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < src.length; j += 1) {
      const ch = src[j];
      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (ch === '\\') {
          esc = true;
          continue;
        }
        if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(src.slice(i, j + 1));
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) out.push(parsed);
          } catch {
            /* skip */
          }
          i = j;
          break;
        }
      }
    }
  }
  return out;
}

function scoreSkillObject(obj) {
  let score = 0;
  if (obj.patch && typeof obj.patch === 'object' && Object.keys(obj.patch).length) score += 10;
  if (obj.reply) score += 3;
  if (obj.done != null) score += 2;
  if (obj.thinking) score += 1;
  return score;
}

function salvageSkillPayload(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  const objects = extractBalancedObjects(raw);
  if (objects.length) {
    objects.sort((a, b) => scoreSkillObject(b) - scoreSkillObject(a));
    return objects[0];
  }
  return tryParseEnvelope(raw);
}

function tryParseEnvelope(raw) {
  const full = String(raw || '');
  const brace = full.indexOf('{');
  const text = (brace >= 0 ? full.slice(brace) : full).trim();
  if (!text.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const candidate = text.match(/\{[\s\S]*\}/)?.[0];
    if (!candidate) return null;
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function isSkillEnvelope(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return obj.reply != null
    || obj.summary != null
    || obj.sparks != null
    || obj.suggested_fields != null
    || obj.done != null
    || obj.continue != null;
}

function peelAssistantText(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const inner = raw.reply || raw.summary;
    if (inner) return String(inner).trim();
  }
  const text = String(raw || '').trim();
  if (!text) return '';
  const parsed = tryParseEnvelope(text);
  if (parsed && isSkillEnvelope(parsed)) {
    const inner = parsed.reply || parsed.summary;
    if (inner) return String(inner).trim();
  }
  return text;
}

function peelThinkingText(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return String(raw.thinking || '').trim();
  }
  const text = String(raw || '').trim();
  if (!text) return '';
  const parsed = tryParseEnvelope(text);
  if (parsed && isSkillEnvelope(parsed)) {
    return String(parsed.thinking || '').trim();
  }
  return text.startsWith('{') && /"done"\s*:/.test(text) ? '' : text;
}

function unwrapSkill(data = {}) {
  const output = data.output && typeof data.output === 'object' ? data.output : {};
  const salvaged = salvageSkillPayload(data.reply)
    || salvageSkillPayload(data.text)
    || salvageSkillPayload(output.reply)
    || salvageSkillPayload(output)
    || {};
  const outputPatch = output.patch && typeof output.patch === 'object' ? output.patch : {};
  const dataPatch = data.patch && typeof data.patch === 'object' ? data.patch : {};
  const salvagedPatch = salvaged.patch && typeof salvaged.patch === 'object' ? salvaged.patch : {};
  const patch = Object.keys(outputPatch).length
    ? outputPatch
    : (Object.keys(dataPatch).length ? dataPatch : salvagedPatch);
  const reply = peelAssistantText(salvaged.reply)
    || peelAssistantText(output.reply)
    || peelAssistantText(salvaged)
    || peelAssistantText(data.reply)
    || peelAssistantText(output.summary)
    || peelAssistantText(data.text);
  const thinking = peelThinkingText(salvaged.thinking)
    || peelThinkingText(data.thinking)
    || peelThinkingText(output.thinking)
    || peelThinkingText(salvaged);
  return {
    reply,
    thinking,
    patch,
    sparks: Array.isArray(output.sparks) ? output.sparks : (Array.isArray(salvaged.sparks) ? salvaged.sparks : (data.sparks || [])),
    suggested_fields: Array.isArray(output.suggested_fields)
      ? output.suggested_fields
      : (Array.isArray(salvaged.suggested_fields) ? salvaged.suggested_fields : []),
    target_fields: Array.isArray(output.target_fields)
      ? output.target_fields
      : (Array.isArray(salvaged.target_fields) ? salvaged.target_fields : []),
  };
}

function digestHistory(messages = [], limit = 10) {
  return messages
    .filter((row) => row.role !== 'thinking')
    .slice(-limit)
    .map((row) => ({
      role: row.role,
      content: peelAssistantText(row.content).slice(0, 400),
    }));
}

module.exports = {
  peelAssistantText,
  peelThinkingText,
  BASIC_FIELDS,
  WORLD_TEXT_FIELDS,
  WORLD_FIELDS,
  CHARACTER_LIST_FIELDS,
  CHARACTER_ITEM_FIELDS,
  CHARACTER_SENTINEL,
  CHARACTER_ROLES,
  CHARACTER_RELATIONS,
  OUTLINE_FIELDS,
  CHAPTER_FIELDS,
  CHAPTER_SCENE_FIELDS,
  CHAPTER_FACTIONS,
  PLAN_FIELDS,
  GENERATABLE_FIELDS,
  isCharacterNestedPath,
  filterGeneratableFields,
  fieldInSceneAllow,
  slimCatalog,
  sanitizePatch,
  sanitizeTimeline,
  countOutlineWords,
  outlineWordWarning,
  unwrapSkill,
  digestHistory,
};
