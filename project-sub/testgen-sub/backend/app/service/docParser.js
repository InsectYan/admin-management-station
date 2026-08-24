'use strict';

const Service = require('egg').Service;
const fs = require('fs').promises;

const HTTP_METHODS = 'GET|POST|PUT|DELETE|PATCH';

function normalizeApiPath(raw) {
  let p = String(raw || '').trim();
  if (!p) return '';
  try {
    if (/^https?:\/\//i.test(p)) {
      p = new URL(p).pathname || p;
    }
  } catch {
    // keep
  }
  p = p.replace(/\?.*$/, '').replace(/\/+$/, '');
  if (!p.startsWith('/')) return '';
  return p || '/';
}

function extractApifoxEndpoints(text) {
  const results = [];
  const seen = new Set();
  const parts = String(text || '').split(/\n(?=##\s+)/);
  for (const part of parts) {
    const m = part.match(/^##\s*(.+?)\s*\n([\s\S]*)/);
    if (!m) continue;
    const heading = m[1].trim();
    const body = m[2];
    const pathMatch = body.match(/\*\*接口URL\*\*[\s\S]*?^>\s*(\S+)\s*$/im);
    if (!pathMatch) continue;
    const apiPath = normalizeApiPath(pathMatch[1]);
    if (!apiPath) continue;
    const methodMatch = body.match(/\*\*请求方式\*\*[\s\S]*?^>\s*(GET|POST|PUT|PATCH|DELETE)\s*$/im);
    const method = (methodMatch?.[1] || 'POST').toUpperCase();
    const key = `${method} ${apiPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ method, path: apiPath, title: heading });
  }
  return results;
}

function extractInlineEndpoints(text) {
  const results = [];
  const seen = new Set();
  const patterns = [
    new RegExp(`\`(${HTTP_METHODS})\\s+(\\/[\\w\\-/{}.:]+)\``, 'gi'),
    new RegExp(`\\b(${HTTP_METHODS})\\s+(\\/[\\w\\-/{}.:]+)`, 'gi'),
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const method = m[1].toUpperCase();
      const apiPath = normalizeApiPath(m[2]);
      if (!apiPath) continue;
      const key = `${method} ${apiPath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ method, path: apiPath, title: '' });
    }
  }
  return results;
}

function extractMarkdownEndpoints(text) {
  const byKey = new Map();
  for (const ep of [ ...extractApifoxEndpoints(text), ...extractInlineEndpoints(text) ]) {
    const key = `${ep.method} ${ep.path}`;
    if (!byKey.has(key)) byKey.set(key, ep);
  }
  return [ ...byKey.values() ];
}

class DocParserService extends Service {
  async parse(document) {
    const { doc_type, file_path, content } = document;
    switch (doc_type) {
      case 'markdown':
        return this.parseMarkdown(content || await fs.readFile(file_path, 'utf8'));
      case 'pdf':
        return this.parsePdf(content || file_path);
      case 'openapi':
        return this.parseOpenApi(content || file_path);
      default:
        throw new Error(`不支持的文档类型: ${doc_type}`);
    }
  }

  parseMarkdown(text) {
    const chapters = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^(#{1,6})\s+(.+)/);
      if (m) chapters.push({ level: m[1].length, title: m[2].trim() });
    }
    const endpoints = extractMarkdownEndpoints(text);
    return {
      content: text,
      parsed_meta: {
        chapters,
        endpoints,
        endpoint_count: endpoints.length,
      },
    };
  }

  async parsePdf(source) {
    const text = typeof source === 'string' && !source.endsWith('.pdf')
      ? source
      : await fs.readFile(source, 'utf8').catch(() => '');
    return {
      content: text,
      parsed_meta: { pages: 1, text: text.slice(0, 500) },
    };
  }

  async parseOpenApi(source) {
    let raw = source;
    if (typeof source === 'string' && (source.endsWith('.json') || source.endsWith('.yaml') || source.endsWith('.yml'))) {
      raw = await fs.readFile(source, 'utf8');
    }
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const endpoints = [ ...text.matchAll(/"(get|post|put|delete|patch)":\s*\{/gi) ]
      .map((_, i) => ({ method: 'GET', path: `/api/endpoint-${i + 1}` }));
    return {
      content: text,
      parsed_meta: { endpoints, format: 'openapi', endpoint_count: endpoints.length },
    };
  }
}

module.exports = DocParserService;
module.exports.extractMarkdownEndpoints = extractMarkdownEndpoints;
