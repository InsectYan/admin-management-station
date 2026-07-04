'use strict';

const { emitProgress } = require('./fitnessRunEvents');

/**
 * 执行步骤跟踪：持久化 ft_run_step + SSE 逐步事件。
 */
class RunStepTracker {
  /**
   * @param {import('egg').Context} ctx
   * @param {number} runId
   */
  constructor(ctx, runId) {
    this.ctx = ctx;
    this.runId = Number(runId);
  }

  /**
   * @param {object} opts
   * @param {number} opts.step_index
   * @param {number} [opts.sub_index]
   * @param {string} [opts.step_name]
   * @param {string} [opts.runner]
   * @param {string} [opts.source]
   * @param {string} [opts.input_summary]
   */
  async begin(opts) {
    const startedAt = new Date();
    const row = await this.ctx.model.FtRunStep.create({
      ft_run_id: this.runId,
      step_index: opts.step_index,
      sub_index: opts.sub_index ?? null,
      step_name: opts.step_name || null,
      runner: opts.runner || 'http',
      source: opts.source || 'config',
      status: 'running',
      started_at: startedAt,
      input_summary: opts.input_summary || null,
    });

    emitProgress(this.runId, {
      event_type: 'step',
      step_event: 'start',
      run_id: this.runId,
      step_id: row.id,
      step_index: opts.step_index,
      sub_index: opts.sub_index,
      step_name: opts.step_name,
      runner: opts.runner || 'http',
      source: opts.source || 'config',
      status: 'running',
      input_summary: opts.input_summary,
      started_at: startedAt.toISOString(),
    });

    return { stepId: row.id, startedAtMs: startedAt.getTime() };
  }

  /**
   * @param {{ stepId: number, startedAtMs: number }} handle
   * @param {object} opts
   */
  async end(handle, opts) {
    const endedAt = new Date();
    const durationMs = Math.max(0, endedAt.getTime() - handle.startedAtMs);
    const status = opts.status || 'pass';

    const row = await this.ctx.model.FtRunStep.findByPk(handle.stepId);
    if (!row) return;

    await row.update({
      status,
      ended_at: endedAt,
      duration_ms: durationMs,
      trace_id: opts.trace_id || null,
      output_summary: opts.output_summary || null,
      detail: opts.detail || {},
    });

    emitProgress(this.runId, {
      event_type: 'step',
      step_event: 'end',
      run_id: this.runId,
      step_id: handle.stepId,
      step_index: row.step_index,
      sub_index: row.sub_index,
      step_name: row.step_name,
      runner: row.runner,
      source: row.source,
      status,
      duration_ms: durationMs,
      trace_id: opts.trace_id || null,
      output_summary: opts.output_summary,
      ended_at: endedAt.toISOString(),
    });
  }

  /** @param {number} runId */
  static async clearForRun(ctx, runId) {
    await ctx.model.FtRunStep.destroy({ where: { ft_run_id: Number(runId) } });
  }
}

module.exports = { RunStepTracker };
