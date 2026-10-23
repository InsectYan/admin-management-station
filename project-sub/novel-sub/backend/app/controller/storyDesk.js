'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

function fail(ctx, err) {
  const status = err.status || 500;
  ctx.status = status;
  ctx.body = { code: status, message: err.message, data: err.issues || null };
}

class StoryDeskController extends Controller {
  async overview() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.overview(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async comparePackages() {
    try {
      const query = this.ctx.query || {};
      ok(this.ctx, await this.ctx.service.storyDesk.comparePackages(this.ctx.params.id, query.from, query.to));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async publish() {
    try {
      const body = this.ctx.request.body || {};
      ok(this.ctx, await this.ctx.service.storyDesk.publish(this.ctx.params.id, body.chapter_ids, body.script_ids, body.intent_ids));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async showPackage() {
    try {
      const version = this.ctx.query.version;
      ok(this.ctx, await this.ctx.service.storyDesk.readPackage(this.ctx.params.packageId, version));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async runConsistency() {
    try {
      const body = this.ctx.request.body || {};
      ok(this.ctx, await this.ctx.service.storyDesk.runConsistency(this.ctx.params.id, body.chapter_ids));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async listPlotlines() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.listPlotlines(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async createPlotline() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.savePlotline(this.ctx.params.id, null, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updatePlotline() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.savePlotline(this.ctx.params.id, this.ctx.params.plotlineId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removePlotline() {
    try {
      await this.ctx.service.storyDesk.removePlotline(this.ctx.params.id, this.ctx.params.plotlineId);
      ok(this.ctx, null);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async bindChapterPlotlines() {
    try {
      const ids = (this.ctx.request.body || {}).plotline_ids;
      ok(this.ctx, await this.ctx.service.storyDesk.bindChapterPlotlines(this.ctx.params.id, this.ctx.params.chapterId, ids));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async listScripts() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.listScripts(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async suggestScript() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.suggestScript(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async createScript() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.saveScript(this.ctx.params.id, null, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updateScript() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.saveScript(this.ctx.params.id, this.ctx.params.scriptId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeScript() {
    try {
      await this.ctx.service.storyDesk.removeScript(this.ctx.params.id, this.ctx.params.scriptId);
      ok(this.ctx, null);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async listIntentShots() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.listIntentShots(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async suggestIntentShots() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.suggestIntentShots(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async createIntentShot() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.saveIntentShot(this.ctx.params.id, null, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updateIntentShot() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.saveIntentShot(this.ctx.params.id, this.ctx.params.shotId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeIntentShot() {
    try {
      await this.ctx.service.storyDesk.removeIntentShot(this.ctx.params.id, this.ctx.params.shotId);
      ok(this.ctx, null);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async recordExport() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.recordExport(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async createTerm() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.saveTerm(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeTerm() {
    try {
      await this.ctx.service.storyDesk.removeTerm(this.ctx.params.id, this.ctx.params.termId);
      ok(this.ctx, null);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async createPromotion() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.createPromotion(this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async applyPromotion() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.applyPromotion(this.ctx.params.id, this.ctx.params.promotionId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async rejectPromotion() {
    try {
      const reason = (this.ctx.request.body || {}).reason;
      ok(this.ctx, await this.ctx.service.storyDesk.rejectPromotion(this.ctx.params.id, this.ctx.params.promotionId, reason));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async saveDownstream() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.saveDownstream(this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async opsSummary() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.opsSummary());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async opsTasks() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.opsTasks(this.ctx.query));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async opsTask() {
    try {
      ok(this.ctx, await this.ctx.service.storyDesk.opsTask(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = StoryDeskController;
