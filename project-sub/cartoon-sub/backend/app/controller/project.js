'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
function fail(ctx, err) {
  ctx.status = err.status || 500;
  ctx.body = { code: ctx.status, message: err.message, data: null };
}

class ProjectController extends Controller {
  async index() {
    ok(this.ctx, await this.ctx.service.project.list());
  }

  async show() {
    try {
      ok(this.ctx, await this.ctx.service.project.show(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async create() {
    const body = this.ctx.request.body || {};
    if (!body.name) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: '需要项目名称', data: null };
      return;
    }
    ok(this.ctx, await this.ctx.service.project.create(body));
  }

  async update() {
    try {
      ok(this.ctx, await this.ctx.service.project.update(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async novels() {
    try {
      ok(this.ctx, await this.ctx.service.project.listNovels());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async chapters() {
    try {
      ok(this.ctx, await this.ctx.service.project.listChapters(this.ctx.params.novelId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async novel() {
    try {
      ok(this.ctx, await this.ctx.service.project.novelBrief(this.ctx.params.novelId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async meta() {
    ok(this.ctx, require('../lib/cartoonMeta').meta());
  }

  async addImport() {
    try {
      ok(this.ctx, await this.ctx.service.project.addImport(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeImport() {
    try {
      ok(this.ctx, await this.ctx.service.project.removeImport(this.ctx.params.id, this.ctx.params.importId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async pullNovel() {
    try {
      const body = this.ctx.request.body || {};
      if (!body.novel_id) this.ctx.throw(400, '需要 novel_id');
      ok(this.ctx, await this.ctx.service.project.pullNovel(this.ctx.params.id, body));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async draft() {
    try {
      ok(this.ctx, await this.ctx.service.draft.run(this.ctx.params.id, this.ctx.params.importId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async addShot() {
    try {
      ok(this.ctx, await this.ctx.service.project.addShot(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updateShot() {
    try {
      ok(this.ctx, await this.ctx.service.project.updateShot(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async generate() {
    const kinds = [ 'image', 'video', 'i2v', 'edit' ];
    const kind = kinds.includes(this.ctx.query.kind) ? this.ctx.query.kind : 'image';
    try {
      ok(this.ctx, await this.ctx.service.generate.start(
        this.ctx.params.id,
        this.ctx.params.shotId,
        this.ctx.request.body || {},
        kind,
      ));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async outputFile() {
    try {
      await this.ctx.service.generate.sendFile(this.ctx.params.id);
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = ProjectController;
