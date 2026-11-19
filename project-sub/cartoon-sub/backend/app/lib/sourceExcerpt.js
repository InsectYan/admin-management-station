'use strict';

function chapterParagraphs(body) {
  const text = String(body || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  let parts = text.split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  if (parts.length < 2) {
    parts = text.split(/\n+/).map(item => item.trim()).filter(Boolean);
  }
  if (parts.length < 2) {
    const sentences = text.split(/(?<=[。！？])/u).map(item => item.trim()).filter(Boolean);
    const chunks = [];
    let buf = '';
    sentences.forEach(sentence => {
      if (buf && (buf + sentence).length > 480) {
        chunks.push(buf);
        buf = sentence;
      } else {
        buf += sentence;
      }
    });
    if (buf) chunks.push(buf);
    parts = chunks.filter(Boolean);
  }
  return parts;
}

function normalizeIndexes(value, count) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，、\s]+/);
  const list = [];
  raw.forEach(item => {
    const n = Number(item);
    if (!Number.isInteger(n) || n < 1 || n > count || list.includes(n)) return;
    list.push(n);
  });
  list.sort((a, b) => a - b);
  return list.slice(0, 8);
}

function excerptFromIndexes(paragraphs, indexes) {
  return normalizeIndexes(indexes, paragraphs.length).map(n => paragraphs[n - 1]).join('\n');
}

function needlesOf(shot) {
  const dialogue = String(shot?.dialogue || '').trim();
  const quotes = dialogue.split(/[「」"“”]/).map(item => item.trim()).filter(item => item.length >= 8);
  if (quotes.length) return quotes;
  return dialogue.length >= 8 ? [ dialogue.slice(0, 80) ] : [];
}

function grams(text) {
  const compact = String(text || '').replace(/\s+/g, '');
  const set = new Set();
  for (let i = 0; i + 1 < compact.length; i += 1) set.add(compact.slice(i, i + 2));
  return set;
}

function matchExcerpt(paragraphs, shot) {
  if (!paragraphs.length) return '';
  const needles = needlesOf(shot);
  let best = -1;
  let bestScore = 0;
  if (needles.length) {
    paragraphs.forEach((paragraph, index) => {
      let score = 0;
      needles.forEach(needle => {
        if (paragraph.includes(needle)) score += needle.length;
      });
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
  }
  if (best < 0) {
    const desc = grams(String(shot?.description || '').slice(0, 400));
    if (desc.size) {
      paragraphs.forEach((paragraph, index) => {
        const set = grams(paragraph);
        let score = 0;
        desc.forEach(gram => { if (set.has(gram)) score += 1; });
        if (score > bestScore) {
          bestScore = score;
          best = index;
        }
      });
    }
  }
  if (best < 0 || bestScore < 8) return '';
  return paragraphs[best].slice(0, 1200);
}

function resolveExcerpt(body, shot, indexes) {
  const paragraphs = chapterParagraphs(body);
  const picked = excerptFromIndexes(paragraphs, indexes);
  if (picked) return picked.slice(0, 1200);
  return matchExcerpt(paragraphs, shot);
}

module.exports = {
  chapterParagraphs,
  excerptFromIndexes,
  matchExcerpt,
  resolveExcerpt,
};
