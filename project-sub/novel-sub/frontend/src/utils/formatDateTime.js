const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_CLOCK = /T\d{2}:\d{2}|[ T]\d{2}:\d{2}(:\d{2})?/;
const OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(n) {
  return String(n).padStart(2, '0');
}

function partsInCst(date) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const cst = new Date(utc + OFFSET_MS);
  return {
    y: cst.getUTCFullYear(),
    m: cst.getUTCMonth() + 1,
    d: cst.getUTCDate(),
    h: cst.getUTCHours(),
    min: cst.getUTCMinutes(),
    s: cst.getUTCSeconds(),
  };
}

/**
 * 墙钟时间：YYYY-MM-DD；有具体时刻则 YYYY-MM-DD HH:mm:ss（东八区）。
 * 纯日期字符串不补 00:00:00。无法解析则原样返回。
 */
export function formatDateTime(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const text = value.trim();
    if (DATE_ONLY.test(text)) return text;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).trim();
  const p = partsInCst(date);
  const day = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  const hasTime = value instanceof Date || HAS_CLOCK.test(String(value));
  if (!hasTime) return day;
  return `${day} ${pad(p.h)}:${pad(p.min)}:${pad(p.s)}`;
}

/** 像日期的显示成规范格式；「开元三年」这类纪元原文不动 */
export function formatLooseDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text) || /^\d{4}\/\d{1,2}\/\d{1,2}/.test(text)) {
    return formatDateTime(text) || text;
  }
  return text;
}
