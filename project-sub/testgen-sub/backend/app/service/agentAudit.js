'use strict';

const Service = require('egg').Service;

class AgentAuditService extends Service {
  /**
   * @param {object} entry
   * @param {string} entry.skill
   * @param {string} entry.action
   * @param {string|number} [entry.run_id]
   * @param {string|number} [entry.job_id]
   * @param {string} [entry.item_id]
   * @param {string} [entry.trace_id]
   * @param {boolean} [entry.ok]
   * @param {string} [entry.error]
   * @param {Array} [entry.tools]
   * @param {object} [entry.detail]
   * @param {number} [entry.duration_ms]
   */
  async log(entry) {
    const payload = {
      skill: entry.skill,
      action: entry.action,
      run_id: entry.run_id || null,
      job_id: entry.job_id || null,
      item_id: entry.item_id || null,
      trace_id: entry.trace_id || null,
      ok: entry.ok !== false,
      error: entry.error || null,
      tools: entry.tools || [],
      duration_ms: entry.duration_ms ?? null,
    };
    this.ctx.app.logger.info('[agentAudit] %j', payload);

    try {
      await this.ctx.model.FtAgentAuditLog.create({
        ft_run_id: payload.run_id ? Number(payload.run_id) : null,
        job_id: payload.job_id ? Number(payload.job_id) : null,
        item_id: payload.item_id,
        skill: payload.skill,
        action: payload.action,
        trace_id: payload.trace_id,
        ok: payload.ok,
        error: payload.error,
        tools: payload.tools,
        detail: entry.detail || {},
        duration_ms: payload.duration_ms,
      });
    } catch (err) {
      this.ctx.app.logger.warn('[agentAudit] persist failed: %s', err.message);
    }

    return payload;
  }

  /**
   * @param {object} query
   */
  async listForRun(runId) {
    return this.ctx.model.FtAgentAuditLog.findAll({
      where: { ft_run_id: Number(runId) },
      order: [[ 'created_at', 'ASC' ]],
    });
  }
}

module.exports = AgentAuditService;
