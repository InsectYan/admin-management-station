'use strict';

const { emitProgress } = require('../../lib/fitnessRunEvents');
const engineRegistry = require('./engineRegistry');
const vsRegistry = require('./vsRegistry');
const jobQueue = require('./jobQueue');
const { AgentHookRunner } = require('./agentHook');

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
      `SELECT t.*,
        cms.scheme_primary_id AS _fallback_scheme_id,
        cms.validation_primary_id AS _fallback_validation_id
       FROM test_item_detail t
       LEFT JOIN test_category_minor_scheme cms ON cms.category_minor_id = t.category_minor_id
       WHERE t.item_id = :itemId AND t.is_active = TRUE
       LIMIT 1`,
      { replacements: { itemId } },
    );
    const item = rows[0];
    if (!item) return null;
    if (!item.scheme_primary_id) item.scheme_primary_id = item._fallback_scheme_id;
    if (!item.validation_primary_id) item.validation_primary_id = item._fallback_validation_id;
    delete item._fallback_scheme_id;
    delete item._fallback_validation_id;
    return item;
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

    if (schemeId === 'TS-04-SET') {
      if (!runConfig?.sample_set_id) {
        const err = new Error('TS-04-SET 需要绑定样本集，请先在方案配置页保存');
        err.status = 400;
        err.code = 'SAMPLE_SET_REQUIRED';
        throw err;
      }
      const sampleCount = await this.ctx.model.FtSampleItem.count({
        where: { sample_set_id: runConfig.sample_set_id },
      });
      if (sampleCount === 0) {
        const err = new Error('绑定的样本集为空');
        err.status = 400;
        err.code = 'SAMPLE_SET_EMPTY';
        throw err;
      }
    }

    if (schemeId === 'TS-02-BND') {
      const matrix = runConfig?.config_json?.matrix;
      if (!Array.isArray(matrix) || !matrix.length) {
        const err = new Error('TS-02-BND 需要 config_json.matrix 非空');
        err.status = 400;
        err.code = 'MATRIX_REQUIRED';
        throw err;
      }
    }

    if (schemeId === 'TS-03-REP') {
      const cfg = runConfig?.config_json || {};
      const thr = runConfig?.threshold_json || {};
      const repeatN = Number(cfg.repeat_count ?? thr.passk_N ?? cfg.passk_N);
      if (!Number.isFinite(repeatN) || repeatN < 1) {
        const err = new Error('TS-03-REP 需要 repeat_count 或 passk_N ≥ 1');
        err.status = 400;
        err.code = 'REPEAT_COUNT_INVALID';
        throw err;
      }
    }

    if (schemeId === 'TS-05-CHAIN') {
      const steps = runConfig?.config_json?.steps;
      if (!Array.isArray(steps) || !steps.length) {
        const err = new Error('TS-05-CHAIN 需要 config_json.steps 非空');
        err.status = 400;
        err.code = 'CHAIN_STEPS_REQUIRED';
        throw err;
      }
    }

    if (schemeId === 'TS-08-OBS') {
      const cfg = runConfig?.config_json || {};
      const hasChecks = Array.isArray(cfg.checks) && cfg.checks.length;
      const hasSingle = cfg.mode || cfg.path || cfg.required_fields;
      if (!hasChecks && !hasSingle) {
        const err = new Error('TS-08-OBS 需要 checks 或 mode/path/required_fields 配置');
        err.status = 400;
        err.code = 'OBS_CONFIG_REQUIRED';
        throw err;
      }
    }

    if (schemeId === 'TS-06-PAIR') {
      const pairs = runConfig?.config_json?.pairs;
      if (pairs != null && (!Array.isArray(pairs) || !pairs.length)) {
        const err = new Error('TS-06-PAIR 需要 config_json.pairs 非空');
        err.status = 400;
        err.code = 'PAIR_ARMS_REQUIRED';
        throw err;
      }
    }

    if (schemeId === 'TS-07-NEG') {
      const cases = runConfig?.config_json?.cases;
      if (!Array.isArray(cases) || !cases.length) {
        const err = new Error('TS-07-NEG 需要 config_json.cases 非空');
        err.status = 400;
        err.code = 'NEG_CASES_REQUIRED';
        throw err;
      }
    }

    if (schemeId === 'TS-09-LOAD') {
      const cfg = runConfig?.config_json || {};
      const path = cfg.path || item.endpoint_path;
      if (!path) {
        const err = new Error('TS-09-LOAD 需要 config_json.path 或 item.endpoint_path');
        err.status = 400;
        err.code = 'LOAD_PATH_REQUIRED';
        throw err;
      }
    }

    if (body.dry_run) {
      return this.executeDryRun(itemId, body);
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
    jobQueue.enqueue(app, async () => {
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
      /** @type {ExecutionContext} */
      const execCtx = { item, runConfig, env, run, ctx: this.ctx };
      const hookRunner = new AgentHookRunner(this.ctx);
      await hookRunner.runPreExecute(execCtx);

      const engine = engineRegistry.get(run.scheme_id);
      emitProgress(runId, {
        phase: 'running',
        percent: 20,
        run_id: runId,
        log_tail: [ `TsEngine: ${run.scheme_id}` ],
      });

      let subResults = await engine.execute(execCtx);

      if (hookRunner.shouldApplyAgentJudge(runConfig)) {
        subResults = await hookRunner.applyPostSubRunJudge(execCtx, subResults);
      }

      await this.ctx.model.FtRunResult.destroy({ where: { ft_run_id: runId } });
      for (const sub of subResults) {
        await this.ctx.model.FtRunResult.create({
          ft_run_id: runId,
          sub_index: sub.sub_index,
          input_summary: sub.input_summary,
          output_summary: sub.output_summary,
          assertion_detail: sub.artifacts
            ? { assertions: sub.assertion_detail || [], artifacts: sub.artifacts }
            : (sub.assertion_detail || []),
          sub_verdict: sub.sub_verdict,
        });
      }

      emitProgress(runId, {
        phase: 'running',
        percent: 70,
        run_id: runId,
        sub_count: subResults.length,
      });

      const vsEngine = vsRegistry.get(run.validation_id, runConfig);
      const verdictResult = await vsEngine.judge(
        subResults,
        runConfig?.threshold_json || {},
        item,
        run.validation_id,
        execCtx,
      );

      const finalStatus = verdictResult.pass ? 'success' : 'failed';
      const progress = {
        phase: 'done',
        percent: 100,
        pass_rate: verdictResult.current_rate,
        target_rate: verdictResult.target_rate,
        rate_level: verdictResult.rate_level,
        passk_N: verdictResult.passk_N,
        passk_M: verdictResult.passk_M,
        pass_count: verdictResult.pass_count,
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
    const vsEngine = vsRegistry.get(body.validation_id || item.validation_primary_id, runConfig);
    const verdictResult = await vsEngine.judge(
      subResults,
      runConfig?.threshold_json || {},
      item,
      body.validation_id || item.validation_primary_id,
      { item, runConfig, env, run: fakeRun, ctx: this.ctx },
    );
    return { sub_results: subResults, ...verdictResult };
  }

  /**
   * dry-run：同步执行，不写 ft_run 持久化记录
   * @param {string} itemId
   * @param {object} body
   */
  async executeDryRun(itemId, body = {}) {
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
      const err = new Error('未配置执行环境');
      err.status = 400;
      throw err;
    }

    const runConfig = await this.ctx.model.FtRunConfig.findOne({
      where: { item_id: itemId, scheme_id: schemeId },
    });

    const fakeRun = {
      id: 0,
      item_id: itemId,
      scheme_id: schemeId,
      validation_id: validationId,
      dry_run: true,
    };

    /** @type {ExecutionContext} */
    const execCtx = { item, runConfig, env, run: fakeRun, ctx: this.ctx };
    const hookRunner = new AgentHookRunner(this.ctx);
    await hookRunner.runPreExecute(execCtx);

    const engine = engineRegistry.get(schemeId);
    let subResults = await engine.execute(execCtx);
    if (hookRunner.shouldApplyAgentJudge(runConfig)) {
      subResults = await hookRunner.applyPostSubRunJudge(execCtx, subResults);
    }

    const vsEngine = vsRegistry.get(validationId, runConfig);
    const verdictResult = await vsEngine.judge(
      subResults,
      runConfig?.threshold_json || {},
      item,
      validationId,
      execCtx,
    );

    return {
      dry_run: true,
      item_id: itemId,
      scheme_id: schemeId,
      validation_id: validationId,
      sub_results: subResults,
      ...verdictResult,
    };
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
