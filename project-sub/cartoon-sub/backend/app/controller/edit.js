'use strict';

const Controller = require('egg').Controller;
const { inspect } = require('../lib/mediaTools');

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
const { fail } = require('../lib/httpError');

class EditController extends Controller {
  async tools() {
    try {
      ok(this.ctx, await inspect(this.app));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async show() {
    try {
      ok(this.ctx, await this.ctx.service.edit.presentProject(this.ctx.params.id, {
        importId: this.ctx.query.import_id,
      }));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async save() {
    try {
      ok(this.ctx, await this.ctx.service.edit.save(this.ctx.params.id, this.ctx.request.body || {}, {
        importId: this.ctx.query.import_id,
      }));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async seed() {
    try {
      ok(this.ctx, await this.ctx.service.edit.seed(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async open() {
    try {
      ok(this.ctx, await this.ctx.service.edit.openDraft(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async importVideo() {
    const files = this.ctx.request.files || [];
    const file = files[0];
    try {
      if (!file) this.ctx.throw(400, '请选择视频');
      ok(this.ctx, await this.ctx.service.edit.saveImport(this.ctx.params.id, file));
    } catch (err) {
      fail(this.ctx, err);
    } finally {
      if (this.ctx.cleanupRequestFiles) await this.ctx.cleanupRequestFiles().catch(() => {});
    }
  }

  async removeImport() {
    try {
      ok(this.ctx, await this.ctx.service.edit.removeImport(this.ctx.params.id, this.ctx.params.token));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async importFile() {
    try {
      await this.ctx.service.edit.sendImport(this.ctx.params.id, this.ctx.params.token);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async startExport() {
    try {
      ok(this.ctx, await this.ctx.service.editExport.start(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async job() {
    try {
      ok(this.ctx, await this.ctx.service.editExport.show(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = EditController;
