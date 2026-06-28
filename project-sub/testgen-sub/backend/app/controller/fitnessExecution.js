'use strict';

const Controller = require('egg').Controller;

class FitnessExecutionController extends Controller {
  handleError(err) {
    if (err.status === 501) {
      this.ctx.status = 501;
      this.ctx.body = { code: 501, message: err.message, data: { code: err.code } };
      return true;
    }
    return false;
  }

  async listEnvs() {
    const data = await this.service.fitnessExecution.listEnvs(this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async createEnv() {
    const data = await this.service.fitnessExecution.createEnv(this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async updateEnv() {
    const data = await this.service.fitnessExecution.updateEnv(this.ctx.params.id, this.ctx.request.body || {});
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '环境不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async deleteEnv() {
    const ok = await this.service.fitnessExecution.deleteEnv(this.ctx.params.id);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '环境不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
  }

  async healthCheck() {
    try {
      await this.service.fitnessExecution.healthCheck();
    } catch (err) {
      if (this.handleError(err)) return;
      throw err;
    }
  }

  async listSampleSets() {
    const data = await this.service.fitnessExecution.listSampleSets(this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async createSampleSet() {
    const data = await this.service.fitnessExecution.createSampleSet(this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async listRuns() {
    const data = await this.service.fitnessExecution.listRuns(this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async showRun() {
    const data = await this.service.fitnessExecution.getRun(this.ctx.params.runId);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '运行记录不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async getRunConfig() {
    const { itemId } = this.ctx.params;
    const schemeId = this.ctx.query.scheme_id;
    const data = await this.service.fitnessExecution.getRunConfig(itemId, schemeId);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async saveRunConfig() {
    const data = await this.service.fitnessExecution.saveRunConfig(
      this.ctx.params.itemId,
      this.ctx.request.body || {},
    );
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async launch() {
    try {
      const data = await this.service.fitnessExecution.launchRun(
        this.ctx.params.itemId,
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      if (this.handleError(err)) return;
      throw err;
    }
  }

  async cancelRun() {
    const data = await this.service.fitnessExecution.cancelRun(this.ctx.params.runId);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '运行记录不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async executeEngine() {
    try {
      await this.service.fitnessExecution.executeSchemeEngine(this.ctx.params.scheme);
    } catch (err) {
      if (this.handleError(err)) return;
      throw err;
    }
  }
}

module.exports = FitnessExecutionController;
