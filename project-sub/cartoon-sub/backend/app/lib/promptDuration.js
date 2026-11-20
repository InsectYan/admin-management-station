'use strict';

function rangeEnd(chunk, requireDecimal) {
  const rangeRe = /(\d+(?:\.\d+)?)\s*[秒s]?\s*[—–\-－~～到至]\s*(\d+(?:\.\d+)?)\s*[秒s]?/g;
  let max = 0;
  let match;
  while ((match = rangeRe.exec(chunk))) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end <= start || start < 0 || end > 120) continue;
    if (requireDecimal && !match[0].includes('.')) continue;
    if (end > max) max = end;
  }
  return max || null;
}

function declaredSeconds(source) {
  const patterns = [
    /本段视频\s*(\d+(?:\.\d+)?)\s*秒/,
    /【时长】[^【】]{0,40}?(\d+(?:\.\d+)?)\s*秒/,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const sec = Number(match[1]);
    if (sec > 0 && sec <= 120) return sec;
  }
  return null;
}

const MIN_DURATION_SEC = 5;
const VIDEO_MAX_SEC = 15;
const TOTAL_MAX_SEC = 30;
const SPEECH_CHARS_PER_SEC = 4;

function clampDurationSec(value, fallback = 10) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(VIDEO_MAX_SEC, Math.max(MIN_DURATION_SEC, Math.round(n)));
}

function speechSeconds(dialogue) {
  const chars = String(dialogue || '').replace(/\s+/g, '').replace(/[「」“”‘’]/g, '').length;
  if (!chars) return 0;
  return Math.ceil(chars / SPEECH_CHARS_PER_SEC);
}

/** 动作秒数收在 5–15。没有对白就停在这里。有对白时，说不完的部分补到总时长，最多 30 秒。 */
function fitDurationSec(proposed, dialogue, fallback = 10) {
  const n = Number(proposed);
  const raw = Number.isFinite(n) ? Math.round(n) : fallback;
  const video = clampDurationSec(raw, fallback);
  const speech = speechSeconds(dialogue);
  if (!speech) return video;
  const withSpeech = Math.max(video, speech);
  const chosen = raw > video ? Math.max(withSpeech, raw) : withSpeech;
  return Math.min(TOTAL_MAX_SEC, chosen);
}

/** 视频提示词时间轴覆盖到的秒数，换算成毫秒。没有时间轴时返回 null。 */
function promptCoveredMs(text) {
  const source = String(text || '');
  if (!source.trim()) return null;
  const blocks = source.match(/【[^】\n]{0,80}】/g) || [];
  let end = null;
  blocks.forEach(block => {
    const found = rangeEnd(block, false);
    if (found && (!end || found > end)) end = found;
  });
  if (!end) end = rangeEnd(source, true);
  if (!end) end = declaredSeconds(source);
  if (!end) return null;
  return Math.round(end * 1000);
}

module.exports = {
  promptCoveredMs,
  clampDurationSec,
  fitDurationSec,
  speechSeconds,
};
