'use strict';

const { QueryTypes } = require('sequelize');

class GenerationTaskService extends require('egg').Service {
  async register(jobId, taskName) {
    if (!jobId || !taskName?.trim()) return null;
    await this.app.model.query(
      `INSERT INTO generation_task_registry (job_id, task_name)
       VALUES (:jobId, :taskName)
       ON CONFLICT (job_id) DO UPDATE SET task_name = EXCLUDED.task_name`,
      { replacements: { jobId: Number(jobId), taskName: taskName.trim() } },
    );
    return { job_id: Number(jobId), task_name: taskName.trim() };
  }

  async list() {
    const rows = await this.app.model.query(
      `SELECT r.job_id, r.task_name, r.created_at,
              (SELECT COUNT(*) FROM test_item_detail t
               WHERE t.generation_job_id = r.job_id AND t.is_active = TRUE) AS item_count
       FROM generation_task_registry r
       ORDER BY r.job_id DESC`,
      { type: QueryTypes.SELECT },
    );
    return rows;
  }

  /** 清理已无对应 generation_jobs 且无关联用例的注册项 */
  async syncFromItems() {
    const [, meta] = await this.app.model.query(`
      DELETE FROM generation_task_registry r
      WHERE NOT EXISTS (
        SELECT 1 FROM generation_jobs j WHERE j.id = r.job_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM test_item_detail t
        WHERE t.generation_job_id = r.job_id AND t.is_active = TRUE
      )
    `);
    return { removed: meta?.rowCount ?? 0 };
  }
}

module.exports = GenerationTaskService;
