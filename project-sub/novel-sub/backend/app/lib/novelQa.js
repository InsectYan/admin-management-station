'use strict';

/**
 * 小说全流程确定性核检（不调用 LLM）。
 * 模块对齐：基础信息 / 世界观 / 门派 / 人物 / 大纲 / 章节目录 / 正文连续性。
 */

const QA_MODULES = [
  { key: 'basic', label: '立意与概要', group: 'setting' },
  { key: 'world', label: '世界观与背景', group: 'setting' },
  { key: 'factions', label: '门派组织', group: 'setting' },
  { key: 'characters', label: '人物与关系', group: 'setting' },
  { key: 'outline', label: '篇幅大纲', group: 'setting' },
  { key: 'content', label: '章节目录', group: 'setting' },
  { key: 'continuity', label: '正文连续性', group: 'body' },
];

const MODULE_KEYS = QA_MODULES.map((m) => m.key);

function finding(partial) {
  const module = partial.module || 'basic';
  const code = partial.code || 'x';
  const chapter = partial.chapter_id != null ? String(partial.chapter_id) : '';
  const entity = String(partial.entity || '').slice(0, 64);
  const stableId = `f_${module}_${code}_${chapter}_${entity}`.replace(/\s+/g, '_');
  return {
    id: partial.id || stableId,
    module,
    code,
    severity: partial.severity || 'warning',
    entity: partial.entity || '',
    message: partial.message || '',
    evidence: partial.evidence || '',
    suggestion: partial.suggestion || '',
    chapter_id: partial.chapter_id || null,
  };
}

function nonEmpty(text) {
  return String(text || '').trim().length > 0;
}

function collectOutlineTitles(volumes = []) {
  const titles = [];
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (node?.title) titles.push(String(node.title).trim());
      if (Array.isArray(node.groups)) walk(node.groups);
      if (Array.isArray(node.sections)) walk(node.sections);
    }
  };
  walk(volumes);
  return titles.filter(Boolean);
}

function resolveOutlineNode(volumes, outlineRef) {
  const ref = String(outlineRef || '').trim();
  if (!ref) return null;
  let hit = null;
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (String(node?.id || '') === ref || String(node?.title || '').trim() === ref) {
        hit = node;
        return;
      }
      if (Array.isArray(node.groups)) walk(node.groups);
      if (Array.isArray(node.sections)) walk(node.sections);
      if (hit) return;
    }
  };
  walk(volumes);
  return hit;
}

function checkBasic(novel, setting) {
  const findings = [];
  if (!nonEmpty(novel?.title)) {
    findings.push(finding({
      module: 'basic', code: 'missing_title', severity: 'error',
      message: '缺少书名', suggestion: '先在基础信息中填写书名',
    }));
  }
  if (!nonEmpty(novel?.creative_intent)) {
    findings.push(finding({
      module: 'basic', code: 'missing_intent', severity: 'error',
      message: '缺少创作立意', suggestion: '补全立意，便于后续核验基调',
    }));
  }
  if (!nonEmpty(novel?.summary)) {
    findings.push(finding({
      module: 'basic', code: 'missing_summary', severity: 'warning',
      message: '缺少作品简介', suggestion: '补一段带卖点的短简介（列表用）',
    }));
  } else if (String(novel.summary).trim().length < 40) {
    findings.push(finding({
      module: 'basic', code: 'summary_too_short', severity: 'info',
      message: '简介偏短，卖点可能不够清晰',
      evidence: String(novel.summary).slice(0, 80),
    }));
  }
  if (!nonEmpty(novel?.story_overview)) {
    findings.push(finding({
      module: 'basic', code: 'missing_story_overview', severity: 'warning',
      message: '缺少小说概要', suggestion: '补数百～数千字全书背景与主线，供世界观/大纲/正文对照',
    }));
  } else if (String(novel.story_overview).trim().length < 200) {
    findings.push(finding({
      module: 'basic', code: 'story_overview_thin', severity: 'info',
      message: '小说概要偏短，后续设定可能缺少主线锚点',
      evidence: String(novel.story_overview).slice(0, 120),
    }));
  }
  if (!novel?.genre_category_id && !nonEmpty(novel?.genre)) {
    findings.push(finding({
      module: 'basic', code: 'missing_genre', severity: 'warning',
      message: '未选择小说类型',
    }));
  }
  return findings;
}

function checkWorld(setting) {
  const findings = [];
  const world = setting?.world || {};
  const required = [
    ['era', '纪元/时代'],
    ['geography', '地理'],
    ['power_system', '力量体系'],
  ];
  for (const [key, label] of required) {
    if (!nonEmpty(world[key])) {
      findings.push(finding({
        module: 'world', code: `missing_world_${key}`, severity: 'warning',
        message: `世界观缺少「${label}」`, suggestion: `在世界观模块补全 ${label}`,
      }));
    }
  }
  if (!nonEmpty(world.social_rules) && !nonEmpty(world.history_notes)) {
    findings.push(finding({
      module: 'world', code: 'thin_world_lore', severity: 'info',
      message: '社会规则与历史笔记都较空，背景厚度不足',
    }));
  }
  return findings;
}

function checkFactions(setting) {
  const findings = [];
  const factions = Array.isArray(setting?.factions) ? setting.factions : [];
  if (!factions.length) {
    findings.push(finding({
      module: 'factions', code: 'no_factions', severity: 'warning',
      message: '尚未创建任何门派组织', suggestion: '至少补 1～2 个核心势力',
    }));
    return findings;
  }
  const names = new Set();
  for (const row of factions) {
    const name = String(row?.name || '').trim();
    if (!name) {
      findings.push(finding({
        module: 'factions', code: 'faction_unnamed', severity: 'error',
        entity: row?.id || '', message: '存在未命名的门派组织',
      }));
      continue;
    }
    if (names.has(name)) {
      findings.push(finding({
        module: 'factions', code: 'faction_duplicate', severity: 'warning',
        entity: name, message: `门派名称重复：「${name}」`,
      }));
    }
    names.add(name);
    if (!nonEmpty(row.description) && !nonEmpty(row.rules)) {
      findings.push(finding({
        module: 'factions', code: 'faction_thin', severity: 'info',
        entity: name, message: `「${name}」缺少描述或戒律`,
      }));
    }
  }
  return findings;
}

function checkCharacters(setting) {
  const findings = [];
  const characters = Array.isArray(setting?.characters) ? setting.characters : [];
  const factions = Array.isArray(setting?.factions) ? setting.factions : [];
  const factionIds = new Set(factions.map((f) => String(f.id || '')));
  const charIds = new Set(characters.map((c) => String(c.id || '')));

  if (!characters.length) {
    findings.push(finding({
      module: 'characters', code: 'no_characters', severity: 'error',
      message: '尚未创建任何人物', suggestion: '至少补主角与关键配角',
    }));
    return findings;
  }

  const mains = characters.filter((c) => c.role === 'main');
  if (!mains.length) {
    findings.push(finding({
      module: 'characters', code: 'no_main', severity: 'error',
      message: '人物库中没有主角（role=main）',
    }));
  }

  const names = new Set();
  for (const row of characters) {
    const name = String(row?.name || '').trim();
    if (!name) {
      findings.push(finding({
        module: 'characters', code: 'character_unnamed', severity: 'error',
        entity: row?.id || '', message: '存在未命名人物',
      }));
      continue;
    }
    if (names.has(name)) {
      findings.push(finding({
        module: 'characters', code: 'character_duplicate', severity: 'warning',
        entity: name, message: `人物重名：「${name}」`,
      }));
    }
    names.add(name);
    const fid = String(row.faction_id || '').trim();
    if (fid && !factionIds.has(fid)) {
      findings.push(finding({
        module: 'characters', code: 'dangling_faction_id', severity: 'error',
        entity: name, message: `「${name}」所属门派 id 在门派库中不存在`,
      }));
    }
    if (!nonEmpty(row.goal) && row.role === 'main') {
      findings.push(finding({
        module: 'characters', code: 'main_no_goal', severity: 'warning',
        entity: name, message: `主角「${name}」缺少目标`,
      }));
    }
  }

  const edges = Array.isArray(setting?.character_edges) ? setting.character_edges : [];
  for (const edge of edges) {
    const src = String(edge.source || '');
    const tgt = String(edge.target || '');
    if ((src && !charIds.has(src)) || (tgt && !charIds.has(tgt))) {
      findings.push(finding({
        module: 'characters', code: 'dangling_edge', severity: 'error',
        message: '人物关系边指向了不存在的角色',
        evidence: `${src} → ${tgt} (${edge.relation || ''})`,
      }));
    }
  }
  return findings;
}

function checkOutline(setting) {
  const findings = [];
  const volumes = Array.isArray(setting?.outline?.volumes)
    ? setting.outline.volumes
    : (Array.isArray(setting?.volumes) ? setting.volumes : []);
  if (!volumes.length) {
    findings.push(finding({
      module: 'outline', code: 'no_outline', severity: 'error',
      message: '尚未生成篇幅大纲',
    }));
    return findings;
  }
  const titles = collectOutlineTitles(volumes);
  if (titles.length < 2) {
    findings.push(finding({
      module: 'outline', code: 'outline_too_thin', severity: 'warning',
      message: '大纲节点过少，难以支撑章节目录',
    }));
  }
  return findings;
}

function checkContent(setting) {
  const findings = [];
  const chapters = Array.isArray(setting?.chapters) ? setting.chapters : [];
  const volumes = Array.isArray(setting?.outline?.volumes)
    ? setting.outline.volumes
    : (Array.isArray(setting?.volumes) ? setting.volumes : []);

  if (!chapters.length) {
    findings.push(finding({
      module: 'content', code: 'no_chapters', severity: 'error',
      message: '尚未编排章节目录',
    }));
    return findings;
  }

  let dangling = 0;
  let missingRef = 0;
  for (const ch of chapters) {
    const title = String(ch?.title || '').trim() || '未命名章节';
    const ref = String(ch?.outline_ref || '').trim();
    if (!ref) {
      missingRef += 1;
      findings.push(finding({
        module: 'content', code: 'missing_outline_ref', severity: 'warning',
        entity: title, chapter_id: ch.id,
        message: `「${title}」未关联大纲节点`,
      }));
      continue;
    }
    if (!resolveOutlineNode(volumes, ref)) {
      dangling += 1;
      findings.push(finding({
        module: 'content', code: 'dangling_outline_ref', severity: 'error',
        entity: title, chapter_id: ch.id,
        message: `「${title}」的 outline_ref「${ref}」在大纲中不存在`,
      }));
    }
  }
  if (missingRef > 3) {
    findings.push(finding({
      module: 'content', code: 'many_missing_refs', severity: 'warning',
      message: `有 ${missingRef} 章未关联大纲，目录与大纲可能脱节`,
    }));
  }
  if (dangling > 0) {
    findings.push(finding({
      module: 'content', code: 'dangling_refs_summary', severity: 'error',
      message: `有 ${dangling} 章 outline_ref 悬空`,
    }));
  }
  return findings;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkContinuity(novel, setting, bodies = []) {
  const findings = [];
  const chapters = Array.isArray(setting?.chapters) ? [...setting.chapters] : [];
  chapters.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const bodyById = new Map((bodies || []).map((row) => [String(row.chapter_id), row]));
  const characters = Array.isArray(setting?.characters) ? setting.characters : [];
  const factions = Array.isArray(setting?.factions) ? setting.factions : [];
  const charNames = characters.map((c) => String(c.name || '').trim()).filter((n) => n.length >= 2);
  const factionNames = factions.map((f) => String(f.name || '').trim()).filter((n) => n.length >= 2);
  const geography = String(setting?.world?.geography || '');

  let written = 0;
  for (const ch of chapters) {
    const bodyRow = bodyById.get(String(ch.id));
    const body = String(bodyRow?.body || '');
    const wc = Number(bodyRow?.word_count) || 0;
    if (!(wc > 0) && !body.trim()) continue;
    written += 1;
    const title = String(ch.title || '未命名章节');

    if (wc > 0 && wc < 200) {
      findings.push(finding({
        module: 'continuity', code: 'body_too_short', severity: 'warning',
        entity: title, chapter_id: ch.id,
        message: `「${title}」正文仅 ${wc} 字，可能未写完`,
      }));
    }

    // 粗检：正文里像专名的「某某宗/门/派」若不在门派库
    const orgHits = body.match(/[\u4e00-\u9fff]{2,8}(?:宗|门|派|盟|会|教|国|府)/g) || [];
    for (const hit of [...new Set(orgHits)].slice(0, 12)) {
      if (factionNames.some((n) => hit.includes(n) || n.includes(hit))) continue;
      if (charNames.some((n) => hit.includes(n))) continue;
      findings.push(finding({
        module: 'continuity', code: 'unknown_faction', severity: 'warning',
        entity: hit, chapter_id: ch.id,
        message: `「${title}」出现组织名「${hit}」，门派库中未找到近似项`,
        suggestion: '确认是别称后加入门派库，或改为已有势力名',
        evidence: hit,
      }));
    }

    // 人名：库中有名但本章完全未出现主角（仅对有正文的前几章提示）——跳过，噪声大
    // 地名：若地理非空，抽 2～6 字「城/郡/州/山脉」粗匹配
    if (geography) {
      const placeHits = body.match(/[\u4e00-\u9fff]{2,6}(?:城|郡|州|镇|山|谷|海|岛|原|林)/g) || [];
      for (const hit of [...new Set(placeHits)].slice(0, 10)) {
        const stem = hit.replace(/(城|郡|州|镇|山|谷|海|岛|原|林)$/, '');
        if (stem.length < 2) continue;
        if (geography.includes(stem) || geography.includes(hit)) continue;
        findings.push(finding({
          module: 'continuity', code: 'unknown_place', severity: 'info',
          entity: hit, chapter_id: ch.id,
          message: `「${title}」出现地点「${hit}」，地理设定中未直接出现`,
          suggestion: '可补进世界观地理，或确认是别称',
        }));
      }
    }

    // 已知名人误写检测：无；改为：正文引用的「X说」类不强求
    void escapeRegExp;
  }

  if (!chapters.length) {
    findings.push(finding({
      module: 'continuity', code: 'no_chapter_catalog', severity: 'info',
      message: '无章节目录，跳过正文核检',
    }));
  } else if (written === 0) {
    findings.push(finding({
      module: 'continuity', code: 'no_bodies', severity: 'info',
      message: '尚无已写正文，正文连续性待开写后再验',
    }));
  }

  return findings;
}

function checkChapterAgainstSetting(novel, setting, chapter, bodyText, bodyMeta = {}) {
  const findings = [];
  const title = String(chapter?.title || '未命名章节');
  const body = String(bodyText || '');
  const volumes = Array.isArray(setting?.outline?.volumes)
    ? setting.outline.volumes
    : (Array.isArray(setting?.volumes) ? setting.volumes : []);
  const ref = String(chapter?.outline_ref || '').trim();
  if (!ref) {
    findings.push(finding({
      module: 'content', code: 'missing_outline_ref', severity: 'warning',
      entity: title, chapter_id: chapter?.id,
      message: `「${title}」未关联大纲节点`,
    }));
  } else if (!resolveOutlineNode(volumes, ref)) {
    findings.push(finding({
      module: 'content', code: 'dangling_outline_ref', severity: 'error',
      entity: title, chapter_id: chapter?.id,
      message: `outline_ref「${ref}」悬空`,
    }));
  }
  if (!body.trim()) {
    findings.push(finding({
      module: 'continuity', code: 'empty_body', severity: 'info',
      entity: title, chapter_id: chapter?.id,
      message: '本章正文为空',
    }));
    return findings;
  }

  const pseudoBodies = [{
    chapter_id: chapter.id,
    body,
    word_count: bodyMeta.word_count || body.length,
  }];
  const continuity = checkContinuity(novel, {
    ...setting,
    chapters: [chapter],
  }, pseudoBodies);
  return findings.concat(continuity);
}

function runModuleChecks(moduleKey, ctx) {
  const { novel, setting, bodies } = ctx;
  switch (moduleKey) {
    case 'basic': return checkBasic(novel, setting);
    case 'world': return checkWorld(setting);
    case 'factions': return checkFactions(setting);
    case 'characters': return checkCharacters(setting);
    case 'outline': return checkOutline(setting);
    case 'content': return checkContent(setting);
    case 'continuity': return checkContinuity(novel, setting, bodies);
    default: return [];
  }
}

function scoreFromFindings(findings, ignoredIds = []) {
  const active = (findings || []).filter((f) => !ignoredIds.includes(f.id));
  let score = 100;
  for (const f of active) {
    if (f.severity === 'error') score -= 12;
    else if (f.severity === 'warning') score -= 5;
    else score -= 1;
  }
  score = Math.max(0, Math.min(100, score));
  const hasError = active.some((f) => f.severity === 'error');
  const hasWarning = active.some((f) => f.severity === 'warning');
  const status = hasError ? 'fail' : (hasWarning ? 'warn' : 'pass');
  return { score, status, error_count: active.filter((f) => f.severity === 'error').length, warning_count: active.filter((f) => f.severity === 'warning').length, info_count: active.filter((f) => f.severity === 'info').length };
}

function moduleStatuses(findings, ignoredIds = []) {
  const map = {};
  for (const mod of QA_MODULES) {
    const list = (findings || []).filter((f) => f.module === mod.key && !ignoredIds.includes(f.id));
    const hasError = list.some((f) => f.severity === 'error');
    const hasWarning = list.some((f) => f.severity === 'warning');
    map[mod.key] = {
      key: mod.key,
      label: mod.label,
      status: hasError ? 'fail' : (hasWarning ? 'warn' : (list.length ? 'info' : 'pass')),
      count: list.length,
    };
  }
  return map;
}

function buildPipelineReport(ctx, modules = MODULE_KEYS, ignoredIds = []) {
  const selected = (modules || MODULE_KEYS).filter((k) => MODULE_KEYS.includes(k));
  let findings = [];
  for (const key of selected) {
    findings = findings.concat(runModuleChecks(key, ctx));
  }
  const stats = scoreFromFindings(findings, ignoredIds);
  return {
    action: 'check_consistency',
    modules_checked: selected,
    findings,
    modules: moduleStatuses(findings, ignoredIds),
    ...stats,
    passed: stats.status !== 'fail',
    summary: stats.status === 'pass'
      ? '全流程核检通过'
      : `发现 ${stats.error_count} 个错误、${stats.warning_count} 个警告`,
    source: 'deterministic',
  };
}

module.exports = {
  QA_MODULES,
  MODULE_KEYS,
  finding,
  resolveOutlineNode,
  runModuleChecks,
  checkChapterAgainstSetting,
  scoreFromFindings,
  moduleStatuses,
  buildPipelineReport,
};
