import {
  CHARACTER_ROLE_OPTIONS,
  CHAPTER_FACTION_OPTIONS,
  countOutlineWords,
  novelToBasicForm,
  settingToForms,
} from './novelCreateSchema.js';
import { progressLabel } from './novelMeta.js';

export const DETAIL_TABS = [
  { step: 1, key: 'basic', title: '基础信息' },
  { step: 2, key: 'world', title: '世界观' },
  { step: 3, key: 'characters', title: '人物图鉴' },
  { step: 4, key: 'outline', title: '篇幅大纲' },
  { step: 5, key: 'content', title: '内容组织' },
];

export const SUMMARY_PREVIEW_LEN = 200;

export function roleLabel(role) {
  return CHARACTER_ROLE_OPTIONS.find((r) => r.value === role)?.label || role || '-';
}

export function factionLabel(faction) {
  return CHAPTER_FACTION_OPTIONS.find((f) => f.value === faction)?.label || faction || '-';
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

export function tabFilled(tabKey, { basic, worldForm, characters, outlineForm, contentForm }) {
  switch (tabKey) {
    case 'basic':
      return Boolean(basic?.title);
    case 'world':
      return Boolean(
        worldForm?.era
        || worldForm?.geography
        || worldForm?.timeline?.length,
      );
    case 'characters':
      return Boolean(characters?.length);
    case 'outline':
      return Boolean(outlineForm?.volumes?.length);
    case 'content':
      return Boolean(contentForm?.chapters?.length);
    default:
      return false;
  }
}

export function buildProgressMeta({ basic, outlineForm, contentForm }) {
  const wordTarget = countOutlineWords(outlineForm || { volumes: [] });
  const chapterCount = contentForm?.chapters?.length || 0;
  const outlineChapters = countOutlineChapters(outlineForm);
  return {
    percent: Number(basic?.progress_percent) || 0,
    status: basic?.progress_status || 'ongoing',
    statusLabel: progressLabel(basic?.progress_status),
    wordTarget,
    chapterCount,
    outlineChapters,
  };
}
