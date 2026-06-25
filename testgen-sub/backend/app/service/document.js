'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class DocumentService extends Service {
  async list({ page = 1, pageSize = 20, page_size, module } = {}) {
    const size = Number(page_size || pageSize);
    const where = {};
    if (module) {
      where.metadata = { [Op.contains]: { module } };
    }

    const { count, rows } = await this.ctx.model.Document.findAndCountAll({
      where,
      limit: size,
      offset: (page - 1) * size,
      order: [[ 'updated_at', 'DESC' ]],
      attributes: {
        exclude: [ 'content' ],
      },
    });

    return {
      list: rows.map(r => r.toJSON()),
      total: count,
      page: Number(page),
      pageSize: size,
    };
  }

  async findById(id) {
    const row = await this.ctx.model.Document.findByPk(id);
    return row ? row.toJSON() : null;
  }

  async create(payload) {
    const row = await this.ctx.model.Document.create({
      title: payload.title || '未命名文档',
      doc_type: payload.doc_type || 'markdown',
      content: payload.content || null,
      source: payload.source || 'paste',
      tags: payload.tags || [],
      metadata: payload.metadata || {},
      upload_user: payload.upload_user || null,
      parse_status: 'pending',
    });

    await this.parseDocument(row.id);
    return this.findById(row.id);
  }

  async upload(payload, file) {
    const { uploadDir, maxUploadBytes } = this.config.testgen;
    let content = payload.content || null;
    let title = payload.title;
    let docType = payload.doc_type || 'markdown';
    let filePath = null;
    let fileSize = null;

    if (file) {
      if (file.size > maxUploadBytes) {
        const err = new Error('file too large');
        err.status = 400;
        throw err;
      }
      fs.mkdirSync(uploadDir, { recursive: true });
      const ext = path.extname(file.filename || '').toLowerCase();
      const destName = `${Date.now()}_${file.filename || 'upload'}`;
      filePath = path.join(uploadDir, destName);
      await fs.promises.copyFile(file.filepath, filePath);
      fileSize = file.size;
      title = title || file.filename || '上传文档';
      if (ext === '.pdf') docType = 'pdf';
      else if (ext === '.json' || ext === '.yaml' || ext === '.yml') docType = 'openapi';
      else docType = 'markdown';
      if (!content) {
        content = await fs.promises.readFile(filePath, 'utf8');
      }
    }

    if (!content && !filePath) {
      const err = new Error('content or file required');
      err.status = 400;
      throw err;
    }

    const metadata = payload.metadata || {};
    if (payload.module) metadata.module = payload.module;

    const row = await this.ctx.model.Document.create({
      title: title || '未命名文档',
      doc_type: docType,
      content,
      file_path: filePath,
      file_size: fileSize,
      source: 'upload',
      tags: payload.tags || [],
      metadata,
      parse_status: 'parsing',
    });

    await this.parseDocument(row.id);
    const doc = await this.findById(row.id);
    return {
      id: doc.id,
      title: doc.title,
      doc_type: doc.doc_type,
      parse_status: doc.parse_status,
    };
  }

  async parseDocument(id) {
    const row = await this.ctx.model.Document.findByPk(id);
    if (!row) return null;

    await row.update({ parse_status: 'parsing', parse_error: null });

    try {
      const result = await this.ctx.service.docParser.parse(row.toJSON());
      await row.update({
        content: result.content ?? row.content,
        parsed_meta: result.parsed_meta || {},
        parse_status: 'done',
      });
    } catch (err) {
      await row.update({
        parse_status: 'failed',
        parse_error: err.message,
      });
    }

    return this.findById(id);
  }

  async assertParsed(id) {
    const doc = await this.findById(id);
    if (!doc) {
      const err = new Error('document not found');
      err.status = 404;
      throw err;
    }
    if (doc.parse_status !== 'done') {
      const err = new Error('document parse not ready');
      err.status = 400;
      throw err;
    }
    return doc;
  }

  async delete(id) {
    const row = await this.ctx.model.Document.findByPk(id);
    if (!row) return false;
    await row.destroy();
    return true;
  }
}

module.exports = DocumentService;
