/**
 * Skill / Loop 经常把整段 JSON 信封当正文。聊天只展示给人看的 reply / thinking。
 */

function unescapeJsonSlice(raw, start) {
  let i = start;
  let out = '';
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '\\' && i + 1 < raw.length) {
      const n = raw[i + 1];
      if (n === 'u' && /^[0-9a-fA-F]{4}/.test(raw.slice(i + 2, i + 6))) {
        out += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      }
      const map = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/' };
      out += map[n] !== undefined ? map[n] : n;
      i += 2;
      continue;
    }
    if (ch === '"') break;
    out += ch;
    i += 1;
  }
  return out;
}

export function extractJsonStringField(raw, field) {
  const text = String(raw || '');
  const key = `"${field}"`;
  const idx = text.indexOf(key);
  if (idx < 0) return '';
  const colon = text.indexOf(':', idx + key.length);
  if (colon < 0) return '';
  let i = colon + 1;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  if (text[i] !== '"') return '';
  return unescapeJsonSlice(text, i + 1);
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
  return score;
}

function pickBestSkillObject(raw) {
  const objects = extractBalancedObjects(raw);
  if (!objects.length) return tryParseObject(raw);
  objects.sort((a, b) => scoreSkillObject(b) - scoreSkillObject(a));
  return objects[0];
}

const LIFT_KEYS = ['title', 'creative_intent', 'summary'];

export function salvagePatchFromContent(content) {
  const obj = pickBestSkillObject(content);
  if (!obj) return {};
  if (obj.patch && typeof obj.patch === 'object' && !Array.isArray(obj.patch) && Object.keys(obj.patch).length) {
    return obj.patch;
  }
  const lift = {};
  for (const key of LIFT_KEYS) {
    if (obj[key] != null && String(obj[key]).trim()) lift[key] = obj[key];
  }
  return lift;
}

function tryParseObject(raw) {
  const text = String(raw || '').trim();
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
  return (
    obj.reply != null
    || obj.summary != null
    || obj.sparks != null
    || obj.suggested_fields != null
    || obj.done != null
    || obj.continue != null
  );
}

function extractThinkTags(raw) {
  return [...String(raw || '').matchAll(/<think>([\s\S]*?)(?:<\/think>|$)/gi)]
    .map((m) => m[1].trim())
    .filter(Boolean)
    .join('\n\n');
}

export function peelSkillEnvelope(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return {
      reply: String(raw.reply || raw.summary || '').trim(),
      thinking: String(raw.thinking || '').trim(),
    };
  }
  const text = String(raw ?? '');
  if (!text.trim()) return { reply: '', thinking: '' };

  const thinkTags = extractThinkTags(text);
  const parsed = pickBestSkillObject(text);
  if (parsed && isSkillEnvelope(parsed)) {
    return {
      reply: String(parsed.reply || parsed.summary || '').trim(),
      thinking: String(parsed.thinking || thinkTags || '').trim(),
    };
  }

  if (/"reply"\s*:/.test(text) || /"thinking"\s*:/.test(text) || /"(done|sparks|suggested_fields)"\s*:/.test(text)) {
    return {
      reply: extractJsonStringField(text, 'reply') || extractJsonStringField(text, 'summary'),
      thinking: extractJsonStringField(text, 'thinking') || thinkTags,
    };
  }

  if (thinkTags) return { reply: '', thinking: thinkTags };
  return { reply: text.trim(), thinking: '' };
}

export function displayMessageContent(row) {
  const peeled = peelSkillEnvelope(row?.content);
  if (row?.role === 'thinking') return peeled.thinking || peeled.reply;
  return peeled.reply || (looksLikeSkillDump(row?.content) ? '' : String(row?.content || ''));
}

function looksLikeSkillDump(raw) {
  return /"(done|continue|sparks|suggested_fields|patch)"\s*:/.test(String(raw || ''));
}
