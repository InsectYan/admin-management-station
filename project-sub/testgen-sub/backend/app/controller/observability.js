'use strict';

const Controller = require('egg').Controller;

class ObservabilityController extends Controller {
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

  async showTrace() {
    try {
      const data = await this.service.otelTraceQuery.fetchTraceById(this.ctx.params.traceId);
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      if (this.handleError(err)) return;
      throw err;
    }
  }

  async runTraces() {
    try {
      const run = await this.service.fitnessExecution.getRun(this.ctx.params.runId);
      if (!run) {
        this.ctx.status = 404;
        this.ctx.body = { code: 404, message: '运行记录不存在', data: null };
        return;
      }
      const data = await this.service.otelTraceQuery.fetchTracesForRun(run);
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      if (this.handleError(err)) return;
      throw err;
    }
  }

  async runSteps() {
    const data = await this.service.fitnessExecution.listRunSteps(this.ctx.params.runId);
    if (data === null) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '运行记录不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async runAgentAudit() {
    const data = await this.service.fitnessExecution.listRunAgentAudit(this.ctx.params.runId);
    if (data === null) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '运行记录不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async health() {
    const cfg = this.app.config.observability || {};
    let jaegerOk = false;
    if (cfg.enabled !== false) {
      try {
        const axios = require('axios');
        const base = String(cfg.jaegerQueryUrl || '').replace(/\/$/, '');
        const res = await axios.get(`${base}/api/services`, { timeout: 5000, validateStatus: () => true });
        jaegerOk = res.status === 200;
      } catch {
        jaegerOk = false;
      }
    }
    this.ctx.body = {
      code: 0,
      message: 'ok',
      data: {
        enabled: cfg.enabled !== false,
        jaeger_query_url: cfg.jaegerQueryUrl || null,
        jaeger_reachable: jaegerOk,
      },
    };
  }
}

module.exports = ObservabilityController;
