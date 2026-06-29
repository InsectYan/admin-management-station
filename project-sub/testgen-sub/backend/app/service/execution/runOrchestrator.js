'use strict';

const { emitProgress } = require('../../lib/fitnessRunEvents');
const engineRegistry = require('./engineRegistry');
const vsRegistry = require('./vsRegistry');

/**
 * @typedef {object} ExecutionContext
 * @property {object} item
 * @property {object|null} runConfig
 * @property {object|null} env
 * @property {object} run
 * @property {import('egg').Context} ctx
 */

/**
 * @typedef {object} SubRunResult
 * @property {number} sub_index
 * @property {string} [input_summary]
 * @property {string} [output_summary]
 * @property {object} [assertion_detail]
 * @property {string} [sub_verdict]
 * @property {object} [artifacts]
 */

class RunOrchestrator {
  /** @param {import('egg').Context} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.app = ctx.app;
  }

  async loadItem(itemId) {
    const [ rows ] = await this.app.model.query(
      `SELECT * FROM test_item_detail WHERE item_id = :itemId AND is_active = TRUE LIMIT 1`,
      { replacements: { itemId } },
    );
    return rows[0] || null;
  }

  async resolveEnv(envId) {
    if (envId) {
      return this.ctx.model.FtExecutionEnv.findByPk(envId);
    }
    const def = await this.ctx.model.FtExecutionEnv.findOne({
      where: { is_default: true },
      order: [[ 'id', 'ASC' ]],
    });
    if (def) return def;
    return this.ctx.model.FtExecutionEnv.findOne({ order: [[ 'id', 'ASC' ]] });
  }

  /**
   * @param {string} itemId
   * @param {object} body
   */
  async launch(itemId, body = {}) {
    const item = await this.loadItem(itemId);
    if (!item) {
      const err = new Error('测试项不存在');
      err.status = 404;
      throw err;
    }

    const schemeId = body.scheme_id || item.scheme_primary_id;
    const validationId = body.validation_id || item.validation_primary_id;
    engineRegistry.get(schemeId);

    const env = await this.resolveEnv(body.env_id);
    if (!env) {
      const err = new Error('未配置执行环境，请先在执行环境页添加或运行 db 迁移');
      err.status = 400;
      err.code = 'ENV_NOT_CONFIGURED';
      throw err;
    }

    let runConfig = null;
    if (schemeId) {
      runConfig = await this.ctx.model.FtRunConfig.findOne({
        where: { item_id: itemId, scheme_id: schemeId },
      });
    }

    const run = await this.ctx.model.FtRun.create({
      item_id: itemId,
      run_config_id: runConfig?.id || null,
      env_id: env.id,
      scheme_id: schemeId,
      validation_id: validationId,
      status: 'pending',
      progress: { phase: 'pending', percent: 0 },
    });

    const app = this.app;
    const runId = run.id;
    this.ctx.runInBackground(async () => {
      const bgCtx = app.createAnonymousContext();
      try {
        await new RunOrchestrator(bgCtx).executeRun(runId);
      } catch (err) {
        app.logger.error('[fitnessRun] executeRun id=%s %s', runId, err.message);
      }
    });

    return run;
  }

  /** @param {number} runId */
  async executeRun(runId) {
    const run = await this.ctx.model.FtRun.findByPk(runId);
    if (!run || run.status === 'cancelled') return;

    const item = await this.loadItem(run.item_id);
    if (!item) {
      await run.update({
        status: 'failed',
        verdict: 'fail',
        finished_at: new Date(),
        progress: { phase: 'failed', percent: 100, error: '测试项不存在' },
      });
      emitProgress(runId, { phase: 'failed', run_id: runId });
      return;
    }

    const env = run.env_id
      ? await this.ctx.model.FtExecutionEnv.findByPk(run.env_id)
      : null;
    const runConfig = run.run_config_id
      ? await this.ctx.model.FtRunConfig.findByPk(run.run_config_id)
      : await this.ctx.model.FtRunConfig.findOne({
        where: { item_id: run.item_id, scheme_id: run.scheme_id },
      });

    await run.update({
      status: 'running',
      started_at: new Date(),
      progress: { phase: 'running', percent: 5, log_tail: [ 'RunOrchestrator: started' ] },
    });
    emitProgress(runId, { phase: 'running', percent: 5, run_id: runId });

    try {
      const engine = engineRegistry.get(run.scheme_id);
      /** @type {ExecutionContext} */
      const execCtx = { item, runConfig, env, run, ctx: this.ctx };
      emitProgress(runId, {
        phase: 'running',
        percent: 20,
        run_id: runId,
        log_tail: [ `TsEngine: ${run.scheme_id}` ],
      });

      const subResults = await engine.execute(execCtx);

      await this.ctx.model.FtRunResult.destroy({ where: { ft_run_id: runId } });
      for (const sub of subResults) {
        await this.ctx.model.FtRunResult.create({
          ft_run_id: runId,
          sub_index: sub.sub_index,
          input_summary: sub.input_summary,
          output_summary: sub.output_summary,
          assertion_detail: sub.assertion_detail || [],
          sub_verdict: sub.sub_verdict,
        });
      }

      emitProgress(runId, {
        phase: 'running',
        percent: 70,
        run_id: runId,
        sub_count: subResults.length,
      });

      const vsEngine = vsRegistry.get(run.validation_id);
      const verdictResult = await vsEngine.judge(
        subResults,
        runConfig?.threshold_json || {},
        item,
      );

      const finalStatus = verdictResult.pass ? 'success' : 'failed';
      const progress = {
        phase: 'done',
        percent: 100,
        pass_rate: verdictResult.current_rate,
        verdict: verdictResult.verdict,
        log_tail: [ `Verdict: ${verdictResult.verdict}` ],
      };

      await run.update({
        status: finalStatus,
        verdict: verdictResult.verdict,
        progress,
        finished_at: new Date(),
      });

      emitProgress(runId, { ...progress, run_id: runId, status: finalStatus });
    } catch (err) {
      await run.update({
        status: 'failed',
        verdict: 'fail',
        finished_at: new Date(),
        progress: {
          phase: 'failed',
          percent: 100,
          error: err.message,
          code: err.code,
        },
      });
      emitProgress(runId, {
        phase: 'failed',
        run_id: runId,
        error: err.message,
        code: err.code,
      });
      throw err;
    }
  }

  /** @param {string} schemeId @param {object} body */
  async executeSchemeDebug(schemeId, body) {
    const itemId = body.item_id;
    if (!itemId) {
      const err = new Error('item_id 必填');
      err.status = 400;
      throw err;
    }
    const item = await this.loadItem(itemId);
    if (!item) {
      const err = new Error('测试项不存在');
      err.status = 404;
      throw err;
    }
    const env = await this.resolveEnv(body.env_id);
    if (!env) {
      const err = new Error('执行环境不存在');
      err.status = 400;
      throw err;
    }
    const engine = engineRegistry.get(schemeId);
    const fakeRun = { id: 0, item_id: itemId, scheme_id: schemeId };
    const runConfig = await this.ctx.model.FtRunConfig.findOne({
      where: { item_id: itemId, scheme_id: schemeId },
    });
    const subResults = await engine.execute({
      item,
      runConfig,
      env,
      run: fakeRun,
      ctx: this.ctx,
    });
    const vsEngine = vsRegistry.get(body.validation_id || item.validation_primary_id);
    const verdictResult = await vsEngine.judge(
      subResults,
      runConfig?.threshold_json || {},
      item,
    );
    return { sub_results: subResults, ...verdictResult };
  }

  /** @param {object} body */
  async healthCheck(body = {}) {
    const env = await this.resolveEnv(body.env_id);
    if (!env) {
      const err = new Error('执行环境不存在');
      err.status = 404;
      throw err;
    }
    const url = String(env.bff_coach_url || '').replace(/\/$/, '');
    if (!url) {
      return { env_id: env.id, name: env.name, ok: false, message: '未配置 bff_coach_url' };
    }
    const { runHttp } = require('./runners/httpRunner');
    try {
      const res = await runHttp(this.ctx, {
        baseUrl: url,
        path: '/health',
        method: 'GET',
        timeoutMs: 10000,
      });
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      return {
        env_id: env.id,
        name: env.name,
        url: `${url}/health`,
        ok,
        status_code: res.statusCode,
        response_time_ms: res.responseTimeMs,
      };
    } catch (err) {
      return {
        env_id: env.id,
        name: env.name,
        ok: false,
        message: err.message,
      };
    }
  }
}

module.exports = RunOrchestrator;
