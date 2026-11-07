'use strict';

/**
 * 解析网文 TXT（常见 qinkan 等站点导出：GBK/UTF-8，含「楔子」「第001章 标题」）。
 * 服务端职责：识别元信息 + 按章节标题拆分正文。
 */

// 兼容「第001章 天降贵子」「第1章：标题」「第1章-标题」以及单独「楔子」
const CHAPTER_HEAD_RE = /^(?:楔子|序章|序言|引子|前言|开篇|终章|番外(?:\s*[：:\-—\-]?\s*.+)?|第[0-9０-９零一二三四五六七八九十百千两]+[章节回卷部集](?:\s*[：:\-—\-]?\s*.+)?|Chapter\s+\d+(?:\s*[：:\-—\-]?\s*.+)?)\s*$/i;

function decodeTxtBuffer(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  if (!buf.length) return '';
  const asUtf8 = buf.toString('utf8');
  const bad = (asUtf8.match(/\uFFFD/g) || []).length;
  const sample = asUtf8.slice(0, 800);
  const looksBroken = bad > 2 || /Ã.|Â.|å.|æ.|ç./.test(sample);
  if (!looksBroken && /[\u4e00-\u9fff]/.test(sample)) return asUtf8.replace(/^\uFEFF/, '');
  try {
    return new TextDecoder('gb18030').decode(buf).replace(/^\uFEFF/, '');
  } catch {
    return asUtf8.replace(/^\uFEFF/, '');
  }
}

function normalizeText(raw) {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function extractMeta(text, filename = '') {
  const lines = normalizeText(text).split('\n').map(line => line.trim()).filter(Boolean);
  let title = '';
  let author = '';
  const titleHit = (lines[0] || '').match(/《([^》]+)》/);
  if (titleHit) title = titleHit[1].trim();
  if (!title && lines[0]) {
    title = lines[0]
      .replace(/全集.*$/, '')
      .replace(/【.*?】/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();
  }
  if (!title && filename) {
    const fromName = String(filename).match(/《([^》]+)》/);
    title = fromName ? fromName[1] : String(filename).replace(/\.(txt|text)$/i, '').trim();
  }
  for (const line of lines.slice(0, 12)) {
    const authorHit = line.match(/^(?:作者|著者|執筆|执笔)\s*[:：]\s*(.+)$/);
    if (authorHit) {
      author = authorHit[1].trim();
      break;
    }
  }
  return { title: title || '未命名导入小说', author };
}

function isChapterHead(line) {
  const text = String(line || '').trim();
  if (!text || text.length > 80) return false;
  return CHAPTER_HEAD_RE.test(text);
}

function splitChapters(text) {
  const lines = normalizeText(text).split('\n');
  const heads = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isChapterHead(lines[i])) heads.push(i);
  }
  if (!heads.length) {
    const body = lines.join('\n').trim();
    if (!body) return [];
    return [{ title: '全文', body, order: 1 }];
  }

  // 丢掉第一章之前的站点广告等，但保留紧挨首章前的简介若无章节头；首章前非空内容并入首章前言段
  const chapters = [];
  for (let h = 0; h < heads.length; h += 1) {
    const start = heads[h];
    const end = h + 1 < heads.length ? heads[h + 1] : lines.length;
    const title = lines[start].trim();
    let bodyLines = lines.slice(start + 1, end);
    if (h === 0 && start > 0) {
      const preface = lines.slice(0, start)
        .map(line => line.trimEnd())
        .join('\n')
        .replace(/《[^》]+》[\s\S]*?(?=作者|$)/, '')
        .replace(/^(?:作者|著者).+$/m, '')
        .trim();
      // 前言过短视为元信息，不并入
      if (preface && preface.length > 40 && !/qinkan\.net|未删版|精校版/.test(preface)) {
        bodyLines = [ preface, '', ...bodyLines ];
      }
    }
    const body = bodyLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '').trim();
    chapters.push({
      title,
      body,
      order: h + 1,
    });
  }
  return chapters.filter(item => item.title);
}

function makeChapterId(order) {
  return `imp_${String(order).padStart(4, '0')}`;
}

function buildImportPayload({ text, filename, title, author_name }) {
  const decoded = typeof text === 'string' && text
    ? normalizeText(text)
    : '';
  if (!decoded.trim()) {
    const err = new Error('正文为空');
    err.status = 400;
    throw err;
  }
  const meta = extractMeta(decoded, filename);
  const parts = splitChapters(decoded);
  if (!parts.length) {
    const err = new Error('没有识别到章节，请确认是含「第X章 / 楔子」的 TXT');
    err.status = 400;
    throw err;
  }
  const chapters = parts.map((part, index) => ({
    id: makeChapterId(index + 1),
    title: part.title,
    order: index + 1,
    faction: 'hero',
    status: 'done',
    outline_ref: '',
    location: '',
  }));
  const bodies = parts.map((part, index) => ({
    chapter_id: chapters[index].id,
    title: part.title,
    body: part.body,
    word_count: part.body.replace(/\s/g, '').length,
  }));
  return {
    title: String(title || meta.title || '未命名导入小说').trim(),
    author_name: String(author_name || meta.author || '').trim() || null,
    source_kind: 'imported',
    progress_status: 'completed',
    progress_percent: 100,
    status: 'published',
    summary: `由 TXT 导入，共 ${chapters.length} 章。`,
    setting_json: { chapters },
    bodies,
    chapter_count: chapters.length,
  };
}

module.exports = {
  decodeTxtBuffer,
  extractMeta,
  splitChapters,
  buildImportPayload,
  isChapterHead,
};
