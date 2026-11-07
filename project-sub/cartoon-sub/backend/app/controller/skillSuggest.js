'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
const { fail } = require('../lib/httpError');

class SkillSuggestController extends Controller {
  async matchAssets() {
    try {
      ok(this.ctx, await this.ctx.service.skillSuggest.matchAssets(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async suggestAssets() {
    try {
      ok(this.ctx, await this.ctx.service.skillSuggest.suggestAssets(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async applyAssets() {
    try {
      ok(this.ctx, await this.ctx.service.skillSuggest.applyAssets(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async suggestVoice() {
    try {
      ok(this.ctx, await this.ctx.service.skillSuggest.suggestVoice(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async applyVoice() {
    try {
      ok(this.ctx, await this.ctx.service.skillSuggest.applyVoice(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async assignLibraryVoice() {
    try {
      ok(this.ctx, await this.ctx.service.skillSuggest.assignLibraryVoice(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async suggestReview() {
    try {
      ok(this.ctx, await this.ctx.service.skillSuggest.suggestReview(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async applyReview() {
    try {
      ok(this.ctx, await this.ctx.service.skillSuggest.applyReview(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async buildSubtitles() {
    try {
      ok(this.ctx, await this.ctx.service.skillSuggest.buildSubtitles(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = SkillSuggestController;
