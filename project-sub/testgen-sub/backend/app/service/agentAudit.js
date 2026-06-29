'use strict';

const Service = require('egg').Service;

class AgentAuditService extends Service {
  /**
   * @param {object} entry
   * @param {string} entry.skill
   * @param {string} entry.action
   * @param {string} [entry.run_id]
   * @param {string} [entry.job_id]
   * @param {string} [entry.item_id]
   * @param {string} [entry.trace_id]
   * @param {boolean} [entry.ok]
   * @param {string} [entry.error]
   */
  log(entry) {
    const payload = {
      skill: entry.skill,
      action: entry.action,
      run_id: entry.run_id || null,
      job_id: entry.job_id || null,
      item_id: entry.item_id || null,
      trace_id: entry.trace_id || null,
      ok: entry.ok !== false,
      error: entry.error || null,
    };
    this.ctx.app.logger.info('[agentAudit] %j', payload);
    return payload;
  }
}

module.exports = AgentAuditService;
