import {
  CHARACTER_ROLE_OPTIONS,
  CHAPTER_FACTION_OPTIONS,
  FACTION_KIND_OPTIONS,
  FACTION_ALIGNMENT_OPTIONS,
  WIZARD_STEPS,
  countOutlineWords,
  novelToBasicForm,
  settingToForms,
} from './novelCreateSchema.js';
import { progressLabel } from './novelMeta.js';

export const DETAIL_SETTING_TABS = WIZARD_STEPS.map((item) => ({
  step: item.step,
  key: item.key,
  title: item.title.replace(/设定$/, ''),
}));

export const DETAIL_STUDIO_TAB = { step: 7, key: 'chapter', title: '单章开发' };
export const DETAIL_READER_TAB = { step: 8, key: 'reader', title: '全书预览' };

export const DETAIL_TABS = [...DETAIL_SETTING_TABS, DETAIL_STUDIO_TAB, DETAIL_READER_TAB];

export const DETAIL_TAB_MAX = DETAIL_TABS.length;

export const SUMMARY_PREVIEW_LEN = 200;

export function roleLabel(role) {
  return CHARACTER_ROLE_OPTIONS.find((r) => r.value === role)?.label || role || '-';
}

export function factionLabel(faction) {
  return CHAPTER_FACTION_OPTIONS.find((f) => f.value === faction)?.label || faction || '-';
}

export function factionKindLabel(kind) {
  return FACTION_KIND_OPTIONS.find((f) => f.value === kind)?.label || kind || '-';
}

export function factionAlignmentLabel(alignment) {
  return FACTION_ALIGNMENT_OPTIONS.find((f) => f.value === alignment)?.label || alignment || '-';
}

export function roleTagType(role) {
  if (role === 'main') return 'success';
  if (role === 'villain') return 'danger';
  return 'info';
}

export function displayText(value, empty = '未填写') {
  const text = typeof value === 'string' ? value.trim() : value;
  return text || empty;
}

export function parseNovelDetail(novel = {}) {
  const basic = novelToBasicForm(novel);
  const setting = settingToForms(novel.setting_json);
  return { basic, ...setting, novel };
}

export function countOutlineChapters(outlineForm) {
  let count = 0;
  for (const vol of outlineForm?.volumes || []) {
    for (const group of vol.groups || []) {
      count += (group.sections || []).length || 1;
    }
  }
  return count;
}

export function factionStats(chapters = []) {
  const stats = { hero: 0, villain: 0, neutral: 0 };
  chapters.forEach((ch) => {
    if (stats[ch.faction] != null) stats[ch.faction] += 1;
    else stats.neutral += 1;
  });
  const total = chapters.length || 1;
  return {
    ...stats,
    total: chapters.length,
    heroPercent: Math.round((stats.hero / total) * 100),
    villainPercent: Math.round((stats.villain / total) * 100),
  };
}

export function characterRoleStats(characters = []) {
  const stats = { main: 0, support: 0, villain: 0 };
  characters.forEach((c) => {
    if (stats[c.role] != null) stats[c.role] += 1;
    else stats.support += 1;
  });
  return stats;
}

export function tabFilled(tabKey, {
  basic, worldForm, characters, outlineForm, contentForm, factions,
}) {
  switch (tabKey) {
    case 'basic':
      return Boolean(basic?.title);
    case 'world':
      return Boolean(
        worldForm?.era
        || worldForm?.geography
        || worldForm?.timeline?.length,
      );
    case 'factions':
      return Boolean(factions?.length);
    case 'characters':
      return Boolean(characters?.length);
    case 'outline':
      return Boolean(outlineForm?.volumes?.length);
    case 'content':
      return Boolean(contentForm?.chapters?.length);
    case 'chapter':
      return Boolean(contentForm?.chapters?.length);
    case 'reader':
      return Boolean(contentForm?.chapters?.length);
    default:
      return false;
  }
}

export function buildProgressMeta({ basic, outlineForm, contentForm }) {
  const wordTarget = Number(basic?.word_target) || countOutlineWords(outlineForm || { volumes: [] });
  const chapterCount = Number(basic?.chapter_total) || contentForm?.chapters?.length || 0;
  const outlineChapters = countOutlineChapters(outlineForm);
  return {
    percent: Number(basic?.progress_percent) || 0,
    status: basic?.progress_status || 'ongoing',
    statusLabel: progressLabel(basic?.progress_status),
    wordCount: Number(basic?.word_count) || 0,
    wordTarget,
    chapterWritten: Number(basic?.chapter_written) || 0,
    chapterCount,
    outlineChapters,
  };
}
