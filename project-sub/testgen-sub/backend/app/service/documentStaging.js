'use strict';

const Service = require('egg').Service;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PREVIEW_SNIPPET_LEN = 500;
const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.json', '.yaml', '.yml', '.xml', '.csv',
]);
const LINK_EXTENSIONS = new Set([ '.pdf', '.doc', '.docx' ]);

class DocumentStagingService extends Service {
  stagingRoot() {
    const { uploadDir } = this.config.testgen;
    return path.join(uploadDir, 'staging');
  }

  inferDocType(ext) {
    if (ext === '.pdf') return 'pdf';
    if (ext === '.doc' || ext === '.docx') return 'word';
    if (ext === '.json' || ext === '.yaml' || ext === '.yml') return 'openapi';
    return 'markdown';
  }

  isLinkPreview(ext) {
    return LINK_EXTENSIONS.has(ext);
  }

  async readTextContent(filePath, ext) {
    if (this.isLinkPreview(ext)) {
      if (ext === '.pdf') {
        return this.extractPdfText(filePath);
      }
      return null;
    }
    return fs.promises.readFile(filePath, 'utf8');
  }

  async extractPdfText(filePath) {
    try {
      const pdfParse = require('pdf-parse');
      const buffer = await fs.promises.readFile(filePath);
      const result = await pdfParse(buffer);
      return result.text || '';
    } catch (err) {
      this.ctx.app.logger.warn('[documentStaging] pdf text extract failed: %s', err.message);
      return null;
    }
  }

  buildSnippet(text) {
    if (!text || typeof text !== 'string') return '';
    const normalized = text.replace(/\r\n/g, '\n');
    if (normalized.length <= PREVIEW_SNIPPET_LEN) return normalized;
    return normalized.slice(0, PREVIEW_SNIPPET_LEN);
  }

  async saveFromUpload(file) {
    const { maxUploadBytes } = this.config.testgen;
    if (!file) {
      const err = new Error('file required');
      err.status = 400;
      throw err;
    }
    if (file.size > maxUploadBytes) {
      const err = new Error('file too large');
      err.status = 400;
      throw err;
    }

    const ext = path.extname(file.filename || '').toLowerCase() || '.txt';
    const stagingId = crypto.randomBytes(16).toString('hex');
    const stagingDir = path.join(this.stagingRoot(), stagingId);
    await fs.promises.mkdir(stagingDir, { recursive: true });

    const storedName = `original${ext}`;
    const storedPath = path.join(stagingDir, storedName);
    await fs.promises.copyFile(file.filepath, storedPath);

    const fullContent = await this.readTextContent(storedPath, ext);
    const linkPreview = this.isLinkPreview(ext);
    const hasText = fullContent && fullContent.trim().length > 0;

    if (hasText) {
      await fs.promises.writeFile(
        path.join(stagingDir, 'content.txt'),
        fullContent,
        'utf8',
      );
    }

    const meta = {
      id: stagingId,
      title: file.filename || '上传文档',
      doc_type: this.inferDocType(ext),
      file_size: file.size,
      ext,
      stored_path: storedPath,
      has_text_content: hasText,
      content_length: hasText ? fullContent.length : file.size,
      preview_mode: linkPreview && !hasText ? 'link' : 'text',
      created_at: Date.now(),
    };

    await fs.promises.writeFile(
      path.join(stagingDir, 'meta.json'),
      JSON.stringify(meta),
      'utf8',
    );

    return this.buildPreviewPayload(meta, fullContent, { staging_id: stagingId });
  }

  async getMeta(stagingId) {
    const metaPath = path.join(this.stagingRoot(), stagingId, 'meta.json');
    try {
      const raw = await fs.promises.readFile(metaPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async resolveFullContent(stagingId) {
    const meta = await this.getMeta(stagingId);
    if (!meta) {
      const err = new Error('staging not found or expired');
      err.status = 404;
      throw err;
    }

    const contentPath = path.join(this.stagingRoot(), stagingId, 'content.txt');
    if (meta.has_text_content) {
      try {
        return {
          content: await fs.promises.readFile(contentPath, 'utf8'),
          title: meta.title,
          doc_type: meta.doc_type,
        };
      } catch {
        // fall through to re-extract
      }
    }

    const text = await this.readTextContent(meta.stored_path, meta.ext);
    if (text && text.trim()) {
      return { content: text, title: meta.title, doc_type: meta.doc_type };
    }

    const err = new Error('无法从该文件提取文本内容，请上传 Markdown 或文本格式文档');
    err.status = 400;
    throw err;
  }

  async getStoredFilePath(stagingId) {
    const meta = await this.getMeta(stagingId);
    if (!meta?.stored_path) return null;
    return meta.stored_path;
  }

  buildPreviewFromDocument(doc) {
    const content = doc.content || '';
    const ext = doc.file_path ? path.extname(doc.file_path).toLowerCase() : '';
    const linkPreview = doc.doc_type === 'pdf' || doc.doc_type === 'word' || this.isLinkPreview(ext);
    const hasText = content.trim().length > 0;

    const meta = {
      title: doc.title,
      doc_type: doc.doc_type,
      file_size: doc.file_size,
      has_text_content: hasText,
      content_length: hasText ? content.length : doc.file_size || 0,
      preview_mode: linkPreview && !hasText ? 'link' : 'text',
    };

    return this.buildPreviewPayload(meta, content, {
      document_id: doc.id,
      file_url: doc.file_path ? `/api/documents/${doc.id}/file` : null,
    });
  }

  buildPreviewPayload(meta, fullContent, extra = {}) {
    const hasText = meta.has_text_content || (fullContent && fullContent.trim().length > 0);
    const contentLength = meta.content_length
      ?? (hasText ? fullContent.length : meta.file_size || 0);
    const previewMode = meta.preview_mode
      ?? ((meta.doc_type === 'pdf' || meta.doc_type === 'word') && !hasText ? 'link' : 'text');

    const previewText = hasText ? this.buildSnippet(fullContent) : '';
    const truncated = hasText && fullContent.length > PREVIEW_SNIPPET_LEN;

    const fileUrl = extra.file_url
      ?? (extra.staging_id ? `/api/documents/staging/${extra.staging_id}/file` : null);

    return {
      staging_id: extra.staging_id || null,
      document_id: extra.document_id || null,
      title: meta.title,
      doc_type: meta.doc_type,
      file_size: meta.file_size,
      preview_mode: previewMode,
      preview_text: previewText,
      content_length: contentLength,
      truncated,
      has_text_content: hasText,
      parse_ok: true,
      file_url: previewMode === 'link' ? fileUrl : (fileUrl && !hasText ? fileUrl : null),
    };
  }
}

module.exports = DocumentStagingService;
