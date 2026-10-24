'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

function fail(ctx, err) {
  const status = err.status || 500;
  ctx.status = status;
  ctx.body = { code: status, message: err.message || '请求失败', data: null };
}

class ContentController extends Controller {
  async board() {
    try {
      ok(this.ctx, await this.ctx.service.content.board());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async overview() {
    try {
      ok(this.ctx, await this.ctx.service.content.overview(this.ctx.query));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async projects() {
    try {
      ok(this.ctx, await this.ctx.service.content.projects(this.ctx.query));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async jobs() {
    try {
      ok(this.ctx, await this.ctx.service.content.jobs(this.ctx.query));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async showJob() {
    try {
      ok(this.ctx, await this.ctx.service.content.showJob(this.ctx.params.bizApp, this.ctx.params.externalId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async retryJob() {
    try {
      ok(this.ctx, await this.ctx.service.content.retryJob(this.ctx.params.bizApp, this.ctx.params.externalId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async cancelJob() {
    try {
      ok(this.ctx, await this.ctx.service.content.cancelJob(this.ctx.params.bizApp, this.ctx.params.externalId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async lineage() {
    try {
      ok(this.ctx, await this.ctx.service.content.lineage(this.ctx.query.output_id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async viewPrompt() {
    try {
      ok(this.ctx, await this.ctx.service.content.viewPrompt(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async deps() {
    try {
      const config = await this.ctx.service.content.ensureConfig();
      ok(this.ctx, {
        deps: await this.ctx.service.content.deps(),
        probe_interval_sec: config.probe_interval_sec,
      });
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async tick() {
    try {
      ok(this.ctx, await this.ctx.service.content.tick());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async alerts() {
    try {
      ok(this.ctx, await this.ctx.service.content.listAlerts(this.ctx.query));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async ack() {
    try {
      ok(this.ctx, await this.ctx.service.content.ackAlert(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async resolve() {
    try {
      ok(this.ctx, await this.ctx.service.content.resolveAlert(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async audit() {
    try {
      ok(this.ctx, await this.ctx.service.content.listAudit(this.ctx.query));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async recordAudit() {
    try {
      ok(this.ctx, await this.ctx.service.content.recordAudit(this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async settings() {
    try {
      ok(this.ctx, await this.ctx.service.content.getSettings());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updateSettings() {
    try {
      ok(this.ctx, await this.ctx.service.content.updateSettings(this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = ContentController;
