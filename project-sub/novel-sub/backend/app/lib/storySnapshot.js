'use strict';

const crypto = require('crypto');

function hashBody(body) {
  return crypto.createHash('sha256').update(String(body || ''), 'utf8').digest('hex');
}

function releaseState(wordCount, currentHash, publishedHash) {
  if (!wordCount) return 'empty';
  if (!publishedHash) return 'written';
  if (currentHash === publishedHash) return 'published';
  return 'revised';
}

function releaseLabel(state) {
  if (state === 'published') return '已发布';
  if (state === 'revised') return '已修订未发布';
  if (state === 'written') return '已写入';
  return '未写';
}

function characterCard(row) {
  return {
    character_id: String(row?.id || ''),
    name: String(row?.name || '').trim(),
    appearance: String(row?.appearance || ''),
    speech_style: String(row?.speech_style || ''),
    identity: String(row?.identity || ''),
    age: String(row?.age || ''),
    personality: String(row?.personality || ''),
  };
}

function termCard(row) {
  const aliases = Array.isArray(row?.aliases) ? row.aliases : [];
  return {
    term_id: String(row?.id || ''),
    name: String(row?.name || '').trim(),
    aliases: aliases.map(item => String(item || '').trim()).filter(Boolean),
    definition: String(row?.definition || ''),
    category: String(row?.category || 'term'),
  };
}

function sceneCharacters(value) {
  if (Array.isArray(value)) {
    return value.map(item => (item && typeof item === 'object' ? item.name : item)).filter(Boolean).join('、');
  }
  return String(value || '').trim();
}

function normalizeScenes(scenes) {
  if (!Array.isArray(scenes)) return [];
  return scenes.map((scene, index) => ({
    order: Number(scene?.order) || index + 1,
    interior: scene?.interior === 'out' || scene?.interior === '外' ? 'out' : 'in',
    location: String(scene?.location || '').trim(),
    characters: sceneCharacters(scene?.characters),
    dialogue: String(scene?.dialogue || '').trim(),
    action: String(scene?.action || '').trim(),
  })).filter(scene => scene.location || scene.characters || scene.dialogue || scene.action);
}

function scriptSuggestion(raw, fallback = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const nested = source.script && typeof source.script === 'object' ? source.script : null;
  const script = nested || source;
  const variant = script.variant === 'short_drama' || fallback.variant === 'short_drama' ? 'short_drama' : 'comic';
  const scenes = normalizeScenes(script.scenes || source.scenes);
  return {
    title: String(script.title || fallback.title || '').trim(),
    variant,
    chapter_ids: Array.isArray(fallback.chapter_ids) ? fallback.chapter_ids.map(String) : [],
    scenes,
    reply: String(source.reply || '').trim(),
  };
}

function intentSuggestion(raw, fallback = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const list = Array.isArray(source.intent_shots)
    ? source.intent_shots
    : (Array.isArray(source.shots) ? source.shots : []);
  const people = Array.isArray(fallback.characters) ? fallback.characters : [];
  const byName = new Map(people
    .map(item => [ String(item.name || '').trim(), String(item.id || '') ])
    .filter(pair => pair[0] && pair[1]));
  const allowed = new Set(byName.values());
  const scriptId = fallback.script_id == null ? null : Number(fallback.script_id) || null;
  const shots = normalizeIntentShots(list.map(shot => {
    const names = Array.isArray(shot.characters)
      ? shot.characters
      : String(shot.characters || '').split(/[、,，]/);
    const ids = [];
    for (const name of names) {
      const id = byName.get(String(name).trim());
      if (id && !ids.includes(id)) ids.push(id);
    }
    for (const id of (Array.isArray(shot.character_ids) ? shot.character_ids : [])) {
      const text = String(id);
      const mapped = byName.get(text) || (allowed.has(text) ? text : '');
      if (mapped && !ids.includes(mapped)) ids.push(mapped);
    }
    return {
      sort_order: shot.sort_order || shot.order,
      scene_order: shot.scene_order,
      intent: shot.intent,
      dialogue: shot.dialogue,
      emotion: shot.emotion,
      location: shot.location,
      character_ids: ids,
    };
  }));
  return {
    reply: String(source.reply || '').trim(),
    script_id: scriptId,
    shots: shots.map(shot => ({
      script_id: scriptId,
      sort_order: shot.order,
      scene_order: shot.scene_order,
      intent: shot.intent,
      dialogue: shot.dialogue,
      emotion: shot.emotion,
      location: shot.location,
      character_ids: shot.character_ids,
    })),
  };
}

function buildSnapshot({ novel, chapters, terms, scripts, intentShots }) {
  return {
    package_id: `pkg_${novel.id}`,
    narrative_project_id: String(novel.id),
    project_kind: novel.project_kind || 'novel',
    title: novel.title || '',
    characters: (novel.setting_json?.characters || []).map(characterCard).filter(item => item.character_id),
    terms: (terms || []).map(termCard).filter(item => item.name),
    chapters: (chapters || []).map(item => ({
      chapter_id: String(item.chapter_id),
      title: item.title || '未命名章节',
      body_hash: hashBody(item.body),
      body: String(item.body || ''),
    })),
    scripts: (scripts || []).map(script => ({
      script_id: String(script.id),
      title: script.title || '',
      variant: script.variant || 'comic',
      chapter_ids: Array.isArray(script.chapter_ids) ? script.chapter_ids.map(String) : [],
      scenes: normalizeScenes(script.scenes),
    })),
    intent_shots: normalizeIntentShots(intentShots),
  };
}

function namesOf(term) {
  const aliases = Array.isArray(term.aliases) ? term.aliases : [];
  return [ term.name, ...aliases ].map(item => String(item || '').trim()).filter(Boolean);
}

function bannedIssues(text, terms, chapterId) {
  const issues = [];
  const source = String(text || '');
  for (const term of terms || []) {
    if (term.category !== 'banned') continue;
    if (term.status === 'archived') continue;
    const hit = namesOf(term).find(name => source.includes(name));
    if (!hit) continue;
    issues.push({
      chapter_id: chapterId || '',
      rule: 'banned_term',
      level: 'block',
      message: `命中禁用词「${hit}」`,
      source: 'rule',
    });
  }
  return issues;
}

function nameIssues(text, novel, terms, chapterId) {
  const names = [];
  const factions = [];
  for (const character of novel?.setting_json?.characters || []) {
    const name = String(character?.name || '').trim();
    if (name.length >= 2) {
      names.push({ name, archived: character.status === 'archived' || character.archived === true });
    }
  }
  for (const faction of novel?.setting_json?.factions || []) {
    const name = String(faction?.name || '').trim();
    if (name.length >= 2) factions.push(name);
  }
  for (const term of terms || []) {
    if (term.category === 'banned' || term.status === 'archived') continue;
    for (const name of namesOf(term)) {
      if (name.length >= 2) names.push({ name, archived: false });
    }
  }
  const source = String(text || '');
  const issues = [];
  const seen = new Set();
  const talk = /([\u4e00-\u9fff]{2,4})(?=说道|问道|笑道|喊道|说|问|喊)/g;
  let match;
  while ((match = talk.exec(source))) {
    const token = match[1];
    if (seen.has(`name:${token}`)) continue;
    seen.add(`name:${token}`);
    const hit = names.find(item => item.name === token || item.name.includes(token) || token.includes(item.name));
    if (!hit) {
      issues.push({
        chapter_id: chapterId || '',
        rule: 'unknown_name',
        level: 'warn',
        message: `「${token}」没有对应的人物卡或术语`,
        source: 'rule',
      });
      continue;
    }
    if (hit.archived) {
      issues.push({
        chapter_id: chapterId || '',
        rule: 'archived_character',
        level: 'warn',
        message: `已归档人物「${hit.name}」仍出现在正文里`,
        source: 'rule',
      });
    }
  }
  if (factions.length) {
    const org = /[\u4e00-\u9fff]{2,6}(?:教|派|宗|盟)/g;
    while ((match = org.exec(source))) {
      const token = match[0];
      if (seen.has(`org:${token}`)) continue;
      seen.add(`org:${token}`);
      const known = factions.some(name => name.includes(token) || token.includes(name));
      if (known) continue;
      issues.push({
        chapter_id: chapterId || '',
        rule: 'unknown_org',
        level: 'warn',
        message: `「${token}」没有对应的门派或组织`,
        source: 'rule',
      });
    }
  }
  return issues;
}

function plotlineIssues(plotlines, chapters) {
  const list = chapters || [];
  const order = new Map(list.map((chapter, index) => [ String(chapter.id), Number(chapter.order) || index + 1 ]));
  const written = new Set(list.filter(chapter => chapter.written).map(chapter => String(chapter.id)));
  const issues = [];
  for (const line of plotlines || []) {
    const name = String(line.name || '').trim() || '未命名';
    const status = line.status || 'open';
    const kind = line.kind || 'main';
    const events = Array.isArray(line.events) ? line.events : [];
    if (kind !== 'foreshadow') {
      const hit = events.find(event => written.has(String(event.chapter_id || '')));
      if (status === 'open' && hit) {
        issues.push({
          chapter_id: String(hit.chapter_id),
          rule: 'plotline_open',
          level: 'warn',
          message: `剧情线「${name}」已经绑在已写章节上，状态仍是未开始`,
          source: 'rule',
        });
      }
      continue;
    }
    if (status === 'resolved' || status === 'dropped') continue;
    const plant = String(line.plant_chapter_id || '');
    const payoff = String(line.payoff_chapter_id || '');
    if (!payoff) {
      issues.push({
        chapter_id: plant,
        rule: 'foreshadow_open',
        level: 'warn',
        message: `伏笔「${name}」还没有计划回收的章节`,
        source: 'rule',
      });
      continue;
    }
    const plantOrder = order.get(plant);
    const payoffOrder = order.get(payoff);
    if (plantOrder && payoffOrder && payoffOrder < plantOrder) {
      issues.push({
        chapter_id: plant,
        rule: 'foreshadow_order',
        level: 'warn',
        message: `伏笔「${name}」的回收章节排在埋设之前`,
        source: 'rule',
      });
    }
    if (written.has(payoff)) {
      issues.push({
        chapter_id: payoff,
        rule: 'foreshadow_overdue',
        level: 'warn',
        message: `伏笔「${name}」计划回收的章节已经写了，还没标成已回收`,
        source: 'rule',
      });
    }
  }
  return issues;
}

function normalizeIntentShots(shots) {
  if (!Array.isArray(shots)) return [];
  return shots.map((shot, index) => ({
    intent_id: String(shot.intent_id || shot.id || ''),
    script_id: shot.script_id ? String(shot.script_id) : '',
    order: Number(shot.sort_order || shot.order) || index + 1,
    scene_order: Number(shot.scene_order) || 0,
    intent: String(shot.intent || '').trim(),
    dialogue: String(shot.dialogue || '').trim(),
    emotion: String(shot.emotion || '').trim(),
    location: String(shot.location || '').trim(),
    character_ids: Array.isArray(shot.character_ids) ? shot.character_ids.map(id => String(id)) : [],
  })).filter(shot => shot.intent || shot.dialogue || shot.location);
}

function firstDiff(before, after) {
  const left = String(before || '');
  const right = String(after || '');
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) index += 1;
  if (index === left.length && index === right.length) return null;
  const start = Math.max(0, index - 12);
  return {
    before: left.slice(start, index + 24),
    after: right.slice(start, index + 24),
  };
}

function diffSnapshots(left, right) {
  const chapters = [];
  const leftChapters = new Map((left?.chapters || []).map(item => [ String(item.chapter_id), item ]));
  const rightChapters = new Map((right?.chapters || []).map(item => [ String(item.chapter_id), item ]));
  for (const id of new Set([ ...leftChapters.keys(), ...rightChapters.keys() ])) {
    const older = leftChapters.get(id);
    const newer = rightChapters.get(id);
    if (!older) {
      chapters.push({ chapter_id: id, title: newer.title || '', change: 'added' });
      continue;
    }
    if (!newer) {
      chapters.push({ chapter_id: id, title: older.title || '', change: 'removed' });
      continue;
    }
    const olderHash = older.body_hash || hashBody(older.body);
    const newerHash = newer.body_hash || hashBody(newer.body);
    const body = olderHash === newerHash ? null : firstDiff(older.body, newer.body);
    if (!body && older.title === newer.title) continue;
    chapters.push({
      chapter_id: id,
      title: newer.title || older.title || '',
      change: body ? 'changed' : 'title',
      before_title: older.title || '',
      after_title: newer.title || '',
      before: body?.before || '',
      after: body?.after || '',
    });
  }
  const scripts = diffNamed(left?.scripts, right?.scripts, item => String(item.script_id || item.title || ''), item => `${item.title || ''}\n${JSON.stringify(normalizeScenes(item.scenes))}`);
  const intentShots = diffNamed(left?.intent_shots, right?.intent_shots, item => String(item.intent_id || ''), item => `${item.intent || ''}\n${item.dialogue || ''}\n${item.location || ''}`);
  return {
    from: Number(left?.version) || 0,
    to: Number(right?.version) || 0,
    chapters,
    scripts,
    intent_shots: intentShots,
  };
}

function diffNamed(leftList, rightList, keyOf, textOf) {
  const changes = [];
  const leftMap = new Map((leftList || []).map(item => [ keyOf(item), item ]));
  const rightMap = new Map((rightList || []).map(item => [ keyOf(item), item ]));
  for (const key of new Set([ ...leftMap.keys(), ...rightMap.keys() ])) {
    if (!key) continue;
    const older = leftMap.get(key);
    const newer = rightMap.get(key);
    if (!older) changes.push({ id: key, title: newer.title || newer.intent || newer.dialogue || key, change: 'added' });
    else if (!newer) changes.push({ id: key, title: older.title || older.intent || older.dialogue || key, change: 'removed' });
    else if (textOf(older) !== textOf(newer)) changes.push({ id: key, title: newer.title || newer.intent || older.title || older.intent || key, change: 'changed' });
  }
  return changes;
}

function applySentence(body, before, after) {
  const text = String(body || '');
  const from = String(before || '');
  const to = String(after || '');
  if (!from.trim()) {
    const err = new Error('原句不能为空');
    err.status = 400;
    throw err;
  }
  const count = text.split(from).length - 1;
  if (count !== 1) {
    const err = new Error(count === 0 ? '本章正文里没有这句原话' : '原句在本章出现了多次，请改得更完整');
    err.status = 409;
    throw err;
  }
  return text.replace(from, to);
}

module.exports = {
  hashBody,
  releaseState,
  releaseLabel,
  buildSnapshot,
  bannedIssues,
  nameIssues,
  plotlineIssues,
  normalizeScenes,
  scriptSuggestion,
  intentSuggestion,
  diffSnapshots,
  normalizeIntentShots,
  applySentence,
};
