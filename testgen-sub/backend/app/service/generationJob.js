'use strict';

const Service = require('egg').Service;

class GenerationJobService extends Service {
  async createAndRun(payload) {
    const { document_id, module, test_types, options } = payload;

    if (!document_id || !module) {
      const err = new Error('document_id and module are required');
      err.status = 400;
      throw err;
    }

    const doc = await this.ctx.service.document.assertParsed(document_id);

    const job = await this.ctx.model.GenerationJob.create({
      document_id,
      module,
      test_types: test_types || [],
      options: options || {},
      status: 'running',
      started_at: new Date(),
      created_by: this.ctx.state?.user?.id || null,
    });

    try {
      const agentRes = await this.ctx.service.agentProxy.invokeTestgen({
        action: 'generate',
        doc_id: document_id,
        doc_content: doc.content,
        doc_title: doc.title,
        doc_meta: doc.parsed_meta,
        module,
        test_types: test_types || [],
        options: options || {},
        job_id: job.id,
      });

      await this.syncFromAgentOutput(job.id, agentRes, document_id);
      await job.update({ status: 'done', finished_at: new Date() });
    } catch (err) {
      await job.update({
        status: 'failed',
        error_message: err.message,
        finished_at: new Date(),
      });
      this.ctx.app.logger.error('[generationJob] failed job=%s %s', job.id, err.message);
    }

    await job.reload();
    return {
      job_id: job.id,
      status: job.status,
    };
  }

  async findById(id) {
    const row = await this.ctx.model.GenerationJob.findByPk(id);
    if (!row) return null;
    const json = row.toJSON();
    return {
      id: json.id,
      status: json.status,
      current_phase: json.current_phase,
      progress: json.progress,
      steps: json.steps_log || [],
      error_message: json.error_message,
      agent_run_id: json.agent_run_id,
      document_id: json.document_id,
      module: json.module,
      test_types: json.test_types,
      options: json.options,
      started_at: json.started_at,
      finished_at: json.finished_at,
      updated_at: json.updated_at,
    };
  }

  async listTestCases(jobId, { page = 1, pageSize = 20, page_size } = {}) {
    const size = Number(page_size || pageSize);
    return this.ctx.service.testCase.list({
      job_id: jobId,
      page,
      pageSize: size,
    });
  }

  async cancel(id) {
    const row = await this.ctx.model.GenerationJob.findByPk(id);
    if (!row) return null;
    if ([ 'done', 'failed', 'cancelled' ].includes(row.status)) {
      const err = new Error(`job cannot be cancelled in status: ${row.status}`);
      err.status = 400;
      throw err;
    }
    await row.update({
      status: 'cancelled',
      finished_at: new Date(),
    });
    return this.findById(id);
  }

  async syncFromAgentOutput(jobId, agentRes, documentId) {
    const { output = {}, meta = {} } = agentRes;
    const steps = output.steps || [];
    const progress = this.phasesToProgress(steps);
    const cases = (output.testCases || []).map(tc =>
      this.normalizeTestCase(tc, jobId, documentId)
    );

    const tx = await this.ctx.model.transaction();
    try {
      await this.ctx.model.GenerationJob.update(
        {
          agent_run_id: meta.run_id || null,
          progress,
          current_phase: 'review',
          steps_log: steps,
        },
        { where: { id: jobId }, transaction: tx },
      );
      if (cases.length) {
        await this.ctx.model.TestCase.bulkCreate(cases, { transaction: tx });
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  phasesToProgress(steps) {
    const phases = [ 'analyze', 'functional', 'edge', 'review' ];
    const progress = Object.fromEntries(phases.map(p => [ p, 0 ]));
    for (const step of steps) {
      if (phases.includes(step.phase)) progress[step.phase] = 100;
    }
    if (steps.length) {
      const last = steps[steps.length - 1].phase;
      if (phases.includes(last) && progress[last] < 100) progress[last] = 50;
    }
    return progress;
  }

  normalizeTestCase(tc, jobId, documentId) {
    return {
      job_id: jobId,
      document_id: documentId,
      case_id: tc.case_id || tc.caseId || `TC-${jobId}-${Math.random().toString(36).slice(2, 8)}`,
      title: tc.title || '未命名用例',
      module: tc.module,
      type: tc.type,
      priority: tc.priority || 'medium',
      status: tc.status || 'pending',
      confidence: tc.confidence ?? 0,
      compliance: tc.compliance || 'unverified',
      preconditions: tc.preconditions || null,
      steps: tc.steps || [],
      expected: tc.expected || null,
      tags: tc.tags || [],
    };
  }
}

module.exports = GenerationJobService;
