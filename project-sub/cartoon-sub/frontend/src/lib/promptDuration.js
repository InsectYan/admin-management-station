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

export function fitDurationSec(proposed, dialogue, fallback = 10) {
  const n = Number(proposed);
  const raw = Number.isFinite(n) ? Math.round(n) : fallback;
  const video = Math.min(15, Math.max(5, raw));
  const chars = String(dialogue || '').replace(/\s+/g, '').replace(/[「」“”‘’]/g, '').length;
  if (!chars) return video;
  const speech = Math.ceil(chars / 4);
  const withSpeech = Math.max(video, speech);
  const chosen = raw > video ? Math.max(withSpeech, raw) : withSpeech;
  return Math.min(30, chosen);
}

export function promptCoveredMs(text) {
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

export function formatCoveredSeconds(ms) {
  const sec = Math.round(Number(ms) / 100) / 10;
  if (!Number.isFinite(sec) || sec <= 0) return '';
  return Number.isInteger(sec) ? String(sec) : sec.toFixed(1);
}
