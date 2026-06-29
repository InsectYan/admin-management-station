'use strict';

const { PassThrough } = require('stream');
const Controller = require('egg').Controller;
const { subscribe, emitProgress } = require('../lib/fitnessRunEvents');

class FitnessExecutionController extends Controller {
  handleError(err) {
    const status = err.status || 500;
    if (status >= 400 && status < 600) {
      this.ctx.status = status;
      this.ctx.body = {
        code: err.code || status,
        message: err.message,
        data: null,
      };
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
      const data = await this.service.fitnessExecution.healthCheck(this.ctx.request.body || {});
      this.ctx.body = { code: 0, message: 'ok', data };
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

  async showSampleSet() {
    const data = await this.service.fitnessExecution.getSampleSet(this.ctx.params.setId);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '样本集不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async updateSampleSet() {
    const data = await this.service.fitnessExecution.updateSampleSet(
      this.ctx.params.setId,
      this.ctx.request.body || {},
    );
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '样本集不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async deleteSampleSet() {
    const ok = await this.service.fitnessExecution.deleteSampleSet(this.ctx.params.setId);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '样本集不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
  }

  async listSampleItems() {
    const data = await this.service.fitnessExecution.listSampleItems(this.ctx.params.setId);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '样本集不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async createSampleItem() {
    try {
      const data = await this.service.fitnessExecution.createSampleItem(
        this.ctx.params.setId,
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      if (this.handleError(err)) return;
      throw err;
    }
  }

  async updateSampleItem() {
    const data = await this.service.fitnessExecution.updateSampleItem(
      this.ctx.params.setId,
      this.ctx.params.itemId,
      this.ctx.request.body || {},
    );
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '样本不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async deleteSampleItem() {
    const ok = await this.service.fitnessExecution.deleteSampleItem(
      this.ctx.params.setId,
      this.ctx.params.itemId,
    );
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '样本不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
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

  async streamRun() {
    const runId = Number(this.ctx.params.runId);
    const run = await this.service.fitnessExecution.getRun(runId);
    if (!run) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '运行记录不存在', data: null };
      return;
    }

    const stream = new PassThrough();
    this.ctx.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    this.ctx.status = 200;
    this.ctx.body = stream;

    subscribe(runId, stream);
    emitProgress(runId, {
      run_id: runId,
      phase: run.progress?.phase || run.status,
      percent: run.progress?.percent ?? 0,
      status: run.status,
      verdict: run.verdict,
    });

    if ([ 'success', 'failed', 'cancelled' ].includes(run.status)) {
      setTimeout(() => stream.end(), 100);
    }
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
      const data = await this.service.fitnessExecution.executeSchemeEngine(
        this.ctx.params.scheme,
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      if (this.handleError(err)) return;
      throw err;
    }
  }

  async explainRun() {
    try {
      const data = await this.service.fitnessExecution.explainRun(this.ctx.params.runId);
      if (!data) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '运行记录不存在', data: null };
        return;
      }
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      if (this.handleError(err)) return;
      throw err;
    }
  }

  async generateSamples() {
    try {
      const data = await this.service.fitnessExecution.generateSamples(
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      if (this.handleError(err)) return;
      throw err;
    }
  }
}

module.exports = FitnessExecutionController;
