'use strict';

const Controller = require('egg').Controller;

class ToolsController extends Controller {
  _checkInternalToken() {
    const expected = this.config.internalApiToken;
    if (!expected) return true;
    const token = this.ctx.get('X-Internal-Token');
    if (token !== expected) {
      this.ctx.status = 401;
      this.ctx.body = { code: 401, message: 'unauthorized', data: null };
      return false;
    }
    return true;
  }

  async parseDocument() {
    if (!this._checkInternalToken()) return;

    const { document_id } = this.ctx.request.body || {};
    if (!document_id) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: 'document_id is required', data: null };
      return;
    }

    const doc = await this.service.document.findById(document_id);
    if (!doc) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: 'document not found', data: null };
      return;
    }

    if (doc.parse_status !== 'done') {
      await this.service.document.parseDocument(document_id);
    }

    const updated = await this.service.document.findById(document_id);
    this.ctx.body = {
      code: 0,
      message: 'ok',
      data: {
        document_id: updated.id,
        title: updated.title,
        parse_status: updated.parse_status,
        parsed_meta: updated.parsed_meta,
      },
    };
  }

  async knowledge() {
    if (!this._checkInternalToken()) return;

    const { module, tag, q, limit } = this.ctx.query;
    const data = await this.service.knowledge.search({
      module,
      tag,
      q,
      limit: limit ? Number(limit) : 20,
    });
    this.ctx.body = { code: 0, message: 'ok', data: data.list };
  }
}

module.exports = ToolsController;
