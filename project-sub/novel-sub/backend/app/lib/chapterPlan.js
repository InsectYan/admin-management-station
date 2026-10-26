'use strict';

const CHAPTER_MIN = 2500;
const CHAPTER_MAX = 3500;
const CHAPTER_AIM = 3000;

function planChapters(totalWords) {
  const total = Math.max(Math.round(Number(totalWords) || 0), 0);
  if (!total) {
    return { total: 0, count: 0, per_chapter: CHAPTER_AIM, min: CHAPTER_MIN, max: CHAPTER_MAX };
  }
  let count = Math.max(1, Math.round(total / CHAPTER_AIM));
  let per = Math.round(total / count);
  while (count > 1 && per < CHAPTER_MIN) {
    count -= 1;
    per = Math.round(total / count);
  }
  while (per > CHAPTER_MAX) {
    count += 1;
    per = Math.round(total / count);
  }
  if (per < CHAPTER_MIN) per = CHAPTER_MIN;
  return { total, count, per_chapter: per, min: CHAPTER_MIN, max: CHAPTER_MAX };
}

function bookWordsFromContext(ctx = {}) {
  const length = ctx.basic?.length || {};
  const min = Number(length.min_words) || 0;
  const max = Number(length.max_words) || 0;
  if (min && max) return Math.round((min + max) / 2);
  let sectionWords = 0;
  let groupWords = 0;
  let volumeWords = 0;
  const volumes = ctx.outline?.volumes || ctx.volumes || [];
  for (const vol of volumes) {
    volumeWords += Number(vol?.word_target) || 0;
    for (const group of vol?.groups || []) {
      groupWords += Number(group?.word_target) || 0;
      for (const sec of group?.sections || []) sectionWords += Number(sec?.word_target) || 0;
    }
  }
  const outline = sectionWords || groupWords || volumeWords;
  if (outline > 0) return outline;
  return min || max || 80000;
}

function alignGeneratedChapters(chapters, plan) {
  const list = Array.isArray(chapters) ? chapters : [];
  if (!plan?.count) return { chapters: list, notice: '' };
  if (list.length > plan.count) {
    return {
      chapters: list.slice(0, plan.count),
      notice: `按全书约 ${plan.total} 字，应分为 ${plan.count} 章、每章约 ${plan.per_chapter} 字，已保留前 ${plan.count} 章。`,
    };
  }
  if (list.length < plan.count) {
    return {
      chapters: list,
      notice: `按全书约 ${plan.total} 字，应生成 ${plan.count} 章、每章 ${plan.per_chapter} 字（2500–3500）。这次只有 ${list.length} 章。`,
    };
  }
  return {
    chapters: list,
    notice: `已按全书约 ${plan.total} 字分为 ${plan.count} 章，每章约 ${plan.per_chapter} 字。`,
  };
}

module.exports = {
  CHAPTER_MIN,
  CHAPTER_MAX,
  CHAPTER_AIM,
  planChapters,
  bookWordsFromContext,
  alignGeneratedChapters,
};
