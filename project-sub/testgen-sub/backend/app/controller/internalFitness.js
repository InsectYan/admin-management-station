'use strict';

const Controller = require('egg').Controller;
const { checkInternalToken } = require('../lib/internalAuth');

class InternalFitnessController extends Controller {
  _auth() {
    return checkInternalToken(this.ctx, this.config.internalApiToken);
  }

  async suggestItems() {
    if (!this._auth()) return;
    const data = await this.service.internalFitness.suggestItems(this.ctx.query || {});
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async bulkSamples() {
    if (!this._auth()) return;
    try {
      const data = await this.service.internalFitness.bulkCreateSampleItems(
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async patchItem() {
    if (!this._auth()) return;
    try {
      const data = await this.service.internalFitness.patchItem(
        this.ctx.params.itemId,
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async dryRunLaunch() {
    if (!this._auth()) return;
    try {
      const data = await this.service.internalFitness.dryRunLaunch(
        this.ctx.params.itemId,
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 400;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }
}

module.exports = InternalFitnessController;
