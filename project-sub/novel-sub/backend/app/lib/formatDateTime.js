'use strict';

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

function formatDateTime(value) {
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

function withFormattedTimes(row) {
  if (!row) return row;
  const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  if (json.created_at != null) json.created_at = formatDateTime(json.created_at);
  if (json.updated_at != null) json.updated_at = formatDateTime(json.updated_at);
  return json;
}

module.exports = { formatDateTime, withFormattedTimes };
