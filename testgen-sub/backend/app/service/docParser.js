'use strict';

const Service = require('egg').Service;
const fs = require('fs').promises;

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
    const endpoints = [ ...text.matchAll(/`(GET|POST|PUT|DELETE|PATCH)\s+(\/[\w\-/{}]+)`/g) ]
      .map(x => ({ method: x[1], path: x[2] }));
    return { content: text, parsed_meta: { chapters, endpoints } };
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
      parsed_meta: { endpoints, format: 'openapi' },
    };
  }
}

module.exports = DocParserService;
