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

  /** 从活跃用例去重 job_id，删除无数据的注册项 */
  async syncFromItems() {
    const activeJobs = await this.app.model.query(
      `SELECT DISTINCT generation_job_id AS job_id
       FROM test_item_detail
       WHERE generation_job_id IS NOT NULL AND is_active = TRUE`,
      { type: QueryTypes.SELECT },
    );
    const activeIds = activeJobs.map(r => Number(r.job_id)).filter(Boolean);

    if (!activeIds.length) {
      const [, meta] = await this.app.model.query(
        'DELETE FROM generation_task_registry',
      );
      return { synced: 0, removed: meta?.rowCount ?? 0 };
    }

    const [, meta] = await this.app.model.query(
      'DELETE FROM generation_task_registry WHERE job_id NOT IN (:ids)',
      { replacements: { ids: activeIds } },
    );
    return { synced: activeIds.length, removed: meta?.rowCount ?? 0 };
  }
}

module.exports = GenerationTaskService;
