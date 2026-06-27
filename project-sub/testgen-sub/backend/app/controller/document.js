'use strict';

const Controller = require('egg').Controller;
const fs = require('fs');
const path = require('path');

class DocumentController extends Controller {
  async index() {
    const { page, page_size, pageSize, module } = this.ctx.query;
    const data = await this.service.document.list({
      page: Number(page) || 1,
      page_size,
      pageSize,
      module,
    });
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const doc = await this.service.document.findById(this.ctx.params.id);
    if (!doc) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'document not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: doc };
  }

  async previewMeta() {
    const data = await this.service.document.getPreviewById(this.ctx.params.id);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'document not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async serveFile() {
    const filePath = await this.service.document.getStoredFilePath(this.ctx.params.id);
    if (!filePath) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'file not found', data: null };
      return;
    }
    this.setFileResponseHeaders(filePath);
    this.ctx.body = fs.createReadStream(filePath);
  }

  async serveStagingFile() {
    const filePath = await this.service.documentStaging.getStoredFilePath(this.ctx.params.id);
    if (!filePath) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'file not found', data: null };
      return;
    }
    this.setFileResponseHeaders(filePath);
    this.ctx.body = fs.createReadStream(filePath);
  }

  setFileResponseHeaders(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.md': 'text/markdown; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    };
    if (typeMap[ext]) {
      this.ctx.set('Content-Type', typeMap[ext]);
    }
    this.ctx.set('Content-Disposition', 'inline');
  }

  async create() {
    const data = await this.service.document.create(this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'created', data };
  }

  async upload() {
    const file = this.ctx.request.files?.[0] || this.ctx.request.files?.file;
    const data = await this.service.document.upload(this.ctx.request.body || {}, file);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async preview() {
    const file = this.ctx.request.files?.[0] || this.ctx.request.files?.file;
    const data = await this.service.document.previewFile(file);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async destroy() {
    const ok = await this.service.document.delete(this.ctx.params.id);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'document not found', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
  }
}

module.exports = DocumentController;
