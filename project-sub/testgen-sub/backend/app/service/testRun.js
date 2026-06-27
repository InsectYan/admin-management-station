'use strict';

const Service = require('egg').Service;
const { randomUUID } = require('crypto');
const { Op } = require('sequelize');

const TERMINAL = new Set([ 'success', 'failed', 'cancelled' ]);

class TestRunService extends Service {
  async createRuns(payload) {
    const {
      case_ids: caseIds,
      env_id: envId,
      mode = 'functional',
      concurrency = 1,
      perf_options: perfOptions = {},
    } = payload;

    if (!Array.isArray(caseIds) || !caseIds.length) {
      const err = new Error('case_ids 不能为空');
      err.status = 400;
      throw err;
    }

    const envConfig = await this.ctx.model.EnvConfig.findByPk(envId);
    if (!envConfig) {
      const err = new Error('环境配置不存在');
      err.status = 404;
      throw err;
    }

    const uniqueIds = [ ...new Set(caseIds.map(id => Number(id)).filter(id => id > 0)) ];
    const cases = await this.ctx.model.TestCase.findAll({
      where: { id: { [Op.in]: uniqueIds } },
    });
    if (!cases.length) {
      const err = new Error('未找到有效测试用例');
      err.status = 404;
      throw err;
    }

    const batchId = cases.length > 1 ? randomUUID() : null;
    const runs = [];

    for (const tc of cases) {
      const run = await this.ctx.model.TestRun.create({
        batch_id: batchId,
        case_id: tc.id,
        env_id: envId,
        mode,
        status: 'pending',
        progress: 0,
        concurrency: Math.max(1, Number(concurrency) || 1),
        perf_options: perfOptions,
      });
      runs.push(run);
    }

    for (const run of runs) {
      this.ctx.runInBackground(async () => {
        const bgCtx = this.app.createAnonymousContext();
        try {
          await bgCtx.service.testRun.executeRun(run.id);
        } catch (err) {
          bgCtx.app.logger.error('[testRun] background run=%s %s', run.id, err.message);
        }
      });
    }

    const childIds = runs.map(r => r.id);
    return {
      run_id: childIds[0],
      batch_id: batchId,
      status: 'pending',
      child_run_ids: childIds,
    };
  }

  async executeRun(runId) {
    const run = await this.ctx.model.TestRun.findByPk(runId);
    if (!run || run.status === 'cancelled') return;

    const testCase = await this.ctx.model.TestCase.findByPk(run.case_id);
    const envConfig = await this.ctx.model.EnvConfig.findByPk(run.env_id);
    if (!testCase || !envConfig) {
      await run.update({
        status: 'failed',
        error_message: '用例或环境不存在',
        finished_at: new Date(),
      });
      return;
    }

    await run.update({ status: 'running', started_at: new Date(), progress: 5 });

    try {
      let success = true;
      if (run.mode === 'performance') {
        const perfRes = await this.ctx.service.executionEngine.executePerformanceRun(
          run,
          testCase.toJSON(),
          envConfig.toJSON(),
        );
        success = perfRes.success;
        await run.update({
          progress: 100,
          total_requests: perfRes.totalRequests,
          success_requests: perfRes.successRequests,
          error_requests: perfRes.errorRequests,
          status: success ? 'success' : 'failed',
          finished_at: new Date(),
        });

        if (success) {
          this.ctx.runInBackground(async () => {
            const bgCtx = this.app.createAnonymousContext();
            await bgCtx.service.testRun.triggerPerfAnalysis(runId);
          });
        }
      } else {
        const funcRes = await this.ctx.service.executionEngine.executeFunctionalRun(
          run,
          testCase.toJSON(),
          envConfig.toJSON(),
        );
        success = funcRes.success;
        await run.update({
          progress: 100,
          total_requests: 1,
          success_requests: success ? 1 : 0,
          error_requests: success ? 0 : 1,
          status: success ? 'success' : 'failed',
          finished_at: new Date(),
          log_tail: success ? '执行成功' : (funcRes.result?.error_message || '断言失败'),
        });
      }
    } catch (err) {
      await run.update({
        status: 'failed',
        error_message: err.message,
        finished_at: new Date(),
        progress: 100,
      });
      this.ctx.app.logger.error('[testRun] executeRun run=%s %s', runId, err.message);
    }
  }

  async triggerPerfAnalysis(runId) {
    const run = await this.ctx.model.TestRun.findByPk(runId);
    if (!run || run.mode !== 'performance') return;

    await run.update({ perf_analysis_status: 'pending' });

    try {
      const perfSamples = await this.ctx.model.PerfResult.findAll({
        where: { run_id: runId },
        order: [[ 'window_start', 'ASC' ]],
      });
      const testCase = await this.ctx.model.TestCase.findByPk(run.case_id);
      const envConfig = await this.ctx.model.EnvConfig.findByPk(run.env_id);

      const agentRes = await this.ctx.service.agentProxy.invokePerfAnalysis({
        action: 'analyze',
        run_id: runId,
        perf_samples: perfSamples.map(p => ({
          window_start: p.window_start,
          tps: p.tps,
          avg_response_time_ms: p.avg_response_time_ms,
          p95_response_time_ms: p.p95_response_time_ms,
          error_rate: p.error_rate,
        })),
        case_meta: testCase ? {
          case_id: testCase.case_id,
          title: testCase.title,
          module: testCase.module,
          url: testCase.http_config?.url || '',
        } : {},
        env_name: envConfig?.name || '',
      });

      await run.update({
        perf_analysis: agentRes?.output?.report || agentRes?.output || null,
        perf_analysis_status: 'done',
        agent_run_id: agentRes?.meta?.analysis_id || agentRes?.meta?.run_id || null,
      });
    } catch (err) {
      await run.update({
        perf_analysis_status: 'failed',
        error_message: `${run.error_message || ''}\n[perf-analysis] ${err.message}`.trim(),
      });
      this.ctx.app.logger.warn('[testRun] perf analysis failed run=%s %s', runId, err.message);
    }
  }

  async findById(id) {
    const run = await this.ctx.model.TestRun.findByPk(id, {
      include: [
        { model: this.ctx.model.TestCase, attributes: [ 'id', 'case_id', 'title', 'module' ] },
        { model: this.ctx.model.EnvConfig, attributes: [ 'id', 'name', 'base_url' ] },
      ],
    });
    if (!run) return null;

    const json = run.toJSON();
    let items = [ json ];

    if (json.batch_id) {
      const siblings = await this.ctx.model.TestRun.findAll({
        where: { batch_id: json.batch_id },
        include: [
          { model: this.ctx.model.TestCase, attributes: [ 'id', 'case_id', 'title' ] },
        ],
        order: [[ 'id', 'ASC' ]],
      });
      items = siblings.map(s => s.toJSON());
    }

    const metrics = await this.buildMetricsSummary(id, json.mode);

    const running = items.filter(i => i.status === 'running').length;
    const success = items.filter(i => i.status === 'success').length;
    const failed = items.filter(i => i.status === 'failed').length;

    const aggregateStatus = this.aggregateBatchStatus(items);
    const aggregateProgress = items.length
      ? items.reduce((sum, i) => sum + (i.progress || 0), 0) / items.length
      : json.progress;

    return {
      ...json,
      status: items.length > 1 ? aggregateStatus : json.status,
      progress: items.length > 1 ? aggregateProgress : json.progress,
      items,
      summary: { running, success, failed, total: items.length },
      metrics,
    };
  }

  aggregateBatchStatus(items) {
    if (items.some(i => i.status === 'running')) return 'running';
    if (items.some(i => i.status === 'pending')) return 'pending';
    if (items.every(i => i.status === 'success')) return 'success';
    if (items.some(i => i.status === 'cancelled') && items.every(i => TERMINAL.has(i.status))) {
      return 'cancelled';
    }
    if (items.every(i => TERMINAL.has(i.status))) return 'failed';
    return 'running';
  }

  async buildMetricsSummary(runId, mode) {
    if (mode === 'performance') {
      const perf = await this.ctx.model.PerfResult.findAll({
        where: { run_id: runId },
        order: [[ 'window_start', 'ASC' ]],
      });
      return perf.map(p => ({
        timestamp: p.window_start,
        responseTime: p.avg_response_time_ms,
        tps: p.tps,
        errorRate: p.error_rate,
        p95: p.p95_response_time_ms,
      }));
    }

    const func = await this.ctx.model.FuncResult.findAll({
      where: { run_id: runId },
      order: [[ 'id', 'ASC' ]],
    });
    return func.map(f => ({
      timestamp: f.created_at,
      responseTime: f.response_time_ms,
    }));
  }

  async list({ page = 1, pageSize = 20 } = {}) {
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const pageNum = Math.max(1, Number(page) || 1);
    const { count, rows } = await this.ctx.model.TestRun.findAndCountAll({
      limit: size,
      offset: (pageNum - 1) * size,
      order: [[ 'id', 'DESC' ]],
      include: [
        { model: this.ctx.model.TestCase, attributes: [ 'case_id', 'title' ] },
        { model: this.ctx.model.EnvConfig, attributes: [ 'name' ] },
      ],
    });
    return {
      list: rows.map(r => r.toJSON()),
      total: count,
      page: pageNum,
      pageSize: size,
    };
  }

  async cancel(id) {
    const run = await this.ctx.model.TestRun.findByPk(id);
    if (!run) return null;
    if (TERMINAL.has(run.status)) {
      const err = new Error(`run 无法取消，当前状态: ${run.status}`);
      err.status = 400;
      throw err;
    }

    const where = run.batch_id
      ? { batch_id: run.batch_id, status: { [Op.notIn]: [ ...TERMINAL ] } }
      : { id: run.id };

    await this.ctx.model.TestRun.update(
      { status: 'cancelled', finished_at: new Date() },
      { where },
    );

    return this.findById(id);
  }

  async getResults(id) {
    const run = await this.findById(id);
    if (!run) return null;

    const runIds = run.items?.map(i => i.id) || [ id ];
    const funcResults = await this.ctx.model.FuncResult.findAll({
      where: { run_id: { [Op.in]: runIds } },
      order: [[ 'run_id', 'ASC' ], [ 'request_index', 'ASC' ]],
    });
    const perfResults = await this.ctx.model.PerfResult.findAll({
      where: { run_id: { [Op.in]: runIds } },
      order: [[ 'window_start', 'ASC' ]],
    });

    return {
      run,
      func_results: funcResults.map(r => r.toJSON()),
      perf_results: perfResults.map(r => r.toJSON()),
      perf_analysis: run.perf_analysis,
      perf_analysis_status: run.perf_analysis_status,
    };
  }
}

module.exports = TestRunService;
