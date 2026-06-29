'use strict';

const RunOrchestrator = require('./runOrchestrator');
const { isLaunchable } = require('./engineRegistry');

const TERMINAL = new Set([ 'success', 'failed', 'cancelled' ]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @param {import('egg').Context} ctx
 * @param {number} runId
 * @param {number} [timeoutMs]
 */
async function waitForRunComplete(ctx, runId, timeoutMs = 300000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const run = await ctx.model.FtRun.findByPk(runId);
    if (!run) return null;
    if (TERMINAL.has(run.status)) return run;
    await sleep(1500);
  }
  const err = new Error(`run ${runId} 等待超时`);
  err.code = 'PLAN_RUN_TIMEOUT';
  throw err;
}

/**
 * @param {import('egg').Context} ctx
 * @param {number} planId
 * @param {number} planItemId
 * @param {object} run
 */
async function upsertPlanItemResult(ctx, planId, planItemId, run) {
  const [ record ] = await ctx.model.TestPlanItemResult.findOrCreate({
    where: { plan_id: planId, plan_item_id: planItemId },
    defaults: { result_status: 'pending' },
  });
  const passed = run.verdict === 'pass' || run.status === 'success';
  await record.update({
    result_status: passed ? 'passed' : 'failed',
    validation_result: run.verdict || run.status,
    ft_run_id: run.id,
    notes: run.progress?.error || null,
  });
  return record;
}

class PlanBatchRunner {
  /** @param {import('egg').Context} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.app = ctx.app;
  }

  /**
   * @param {number} planId
   * @param {object} body
   */
  async launchPlan(planId, body = {}) {
    const plan = await this.ctx.service.fitnessPlan.findById(planId);
    if (!plan) {
      const err = new Error('计划不存在');
      err.status = 404;
      throw err;
    }

    const filterIds = Array.isArray(body.item_ids) && body.item_ids.length
      ? new Set(body.item_ids)
      : null;
    const planItems = (plan.items || []).filter(pi =>
      !filterIds || filterIds.has(pi.item_id),
    );

    if (!planItems.length) {
      const err = new Error('计划中没有可执行的用例');
      err.status = 400;
      err.code = 'PLAN_EMPTY';
      throw err;
    }

    const orchestrator = new RunOrchestrator(this.ctx);
    const env = await orchestrator.resolveEnv(body.env_id);
    if (!env) {
      const err = new Error('未配置执行环境');
      err.status = 400;
      err.code = 'ENV_NOT_CONFIGURED';
      throw err;
    }

    const skipUnlaunchable = body.skip_unlaunchable !== false;
    const summary = {
      plan_id: planId,
      status: 'running',
      total: planItems.length,
      launched: 0,
      skipped: [],
      failed: [],
      runs: [],
    };

    await this.ctx.model.TestPlan.update(
      { status: 'running', updated_at: new Date() },
      { where: { id: planId } },
    );

    const app = this.app;
    const envId = env.id;
    const skipFlag = skipUnlaunchable;

    this.ctx.runInBackground(async () => {
      const bgCtx = app.createAnonymousContext();
      const bgOrchestrator = new RunOrchestrator(bgCtx);
      const batchSummary = { ...summary, launched: 0, skipped: [], failed: [], runs: [] };

      for (const planItem of planItems) {
        try {
          const item = await bgOrchestrator.loadItem(planItem.item_id);
          const schemeId = item?.scheme_primary_id;
          if (!item || !schemeId || !isLaunchable(schemeId)) {
            if (skipFlag) {
              batchSummary.skipped.push({
                item_id: planItem.item_id,
                reason: schemeId ? `方案未实现: ${schemeId}` : '缺少主方案',
              });
              const [ rec ] = await bgCtx.model.TestPlanItemResult.findOrCreate({
                where: { plan_id: planId, plan_item_id: planItem.id },
                defaults: { result_status: 'skipped' },
              });
              await rec.update({ result_status: 'skipped', notes: '方案未实现或缺少配置' });
              continue;
            }
            throw new Error(`${planItem.item_id} 不可执行`);
          }

          const run = await bgOrchestrator.launch(planItem.item_id, {
            env_id: envId,
            scheme_id: schemeId,
            validation_id: item.validation_primary_id,
          });
          const finished = await waitForRunComplete(bgCtx, run.id);
          if (finished) {
            await upsertPlanItemResult(bgCtx, planId, planItem.id, finished);
            batchSummary.runs.push({
              item_id: planItem.item_id,
              run_id: finished.id,
              status: finished.status,
              verdict: finished.verdict,
            });
            batchSummary.launched += 1;
          }
        } catch (err) {
          batchSummary.failed.push({ item_id: planItem.item_id, error: err.message });
          const [ rec ] = await bgCtx.model.TestPlanItemResult.findOrCreate({
            where: { plan_id: planId, plan_item_id: planItem.id },
            defaults: { result_status: 'failed' },
          });
          await rec.update({ result_status: 'failed', notes: err.message });
        }
      }

      const finalStatus = batchSummary.failed.length
        ? (batchSummary.launched ? 'partial_failed' : 'failed')
        : 'completed';

      await bgCtx.model.TestPlan.update(
        { status: finalStatus, updated_at: new Date() },
        { where: { id: planId } },
      );
      app.logger.info('[planBatch] plan=%s status=%s launched=%s skipped=%s failed=%s',
        planId, finalStatus, batchSummary.launched, batchSummary.skipped.length, batchSummary.failed.length);
    });

    return summary;
  }

  /** @param {number} planId */
  async getPlanRunSummary(planId) {
    const plan = await this.ctx.service.fitnessPlan.findById(planId);
    if (!plan) return null;

    const runIds = (plan.results || [])
      .map(r => r.ft_run_id)
      .filter(Boolean);

    let runs = [];
    if (runIds.length) {
      runs = await this.ctx.model.FtRun.findAll({
        where: { id: runIds },
        order: [[ 'id', 'ASC' ]],
      });
    }

    const passed = (plan.results || []).filter(r => r.result_status === 'passed').length;
    const failed = (plan.results || []).filter(r => r.result_status === 'failed').length;
    const skipped = (plan.results || []).filter(r => r.result_status === 'skipped').length;
    const pending = (plan.results || []).filter(r => r.result_status === 'pending').length;

    return {
      plan_id: planId,
      plan_status: plan.status,
      total_items: plan.items?.length || 0,
      passed,
      failed,
      skipped,
      pending,
      results: plan.results,
      runs: runs.map(r => r.toJSON()),
    };
  }
}

module.exports = PlanBatchRunner;
