'use strict';

const Service = require('egg').Service;
const {
  normalizeAndDedupe,
  collectTemplatesFromOutput,
} = require('../lib/apiTemplateGenerationMapper');

const PHASES = [ 'analyze', 'generate', 'review' ];

class ApiTemplateGenerationJobService extends Service {
  async createAndRun(payload) {
    const {
      staging_id,
      document_id,
      document_content,
      document_title,
      document_type,
      project_code,
      project_name,
      options = {},
      llm_profile,
    } = payload;

    if (!project_code) {
      const err = new Error('project_code 为必填项');
      err.status = 400;
      throw err;
    }

    let resolvedContent = document_content || null;
    let resolvedTitle = document_title || null;
    let resolvedType = document_type || null;
    let resolvedDocumentId = document_id || null;

    if (staging_id) {
      const staged = await this.ctx.service.documentStaging.resolveFullContent(staging_id);
      resolvedContent = staged.content;
      resolvedTitle = staged.title;
      resolvedType = staged.doc_type;
    } else if (!resolvedContent && resolvedDocumentId) {
      const doc = await this.ctx.service.document.findById(resolvedDocumentId);
      if (!doc) {
        const err = new Error('document not found');
        err.status = 404;
        throw err;
      }
      resolvedContent = doc.content;
      resolvedTitle = doc.title;
      resolvedType = doc.doc_type;
    }

    if (!resolvedContent) {
      const err = new Error('staging_id, document_id or document_content is required');
      err.status = 400;
      throw err;
    }

    if (!resolvedDocumentId) {
      const doc = await this.ctx.service.document.createRaw({
        title: resolvedTitle || '上传文档',
        doc_type: resolvedType || 'markdown',
        content: resolvedContent,
        metadata: { project_code, project_name },
      });
      resolvedDocumentId = doc.id;
    }

    const jobPayload = {
      document_id: resolvedDocumentId,
      project_code,
      project_name: project_name || project_code,
      options,
      document_content: resolvedContent,
      document_title: resolvedTitle,
      llm_profile,
    };

    const job = await this.ctx.model.ApiTemplateGenerationJob.create({
      document_id: resolvedDocumentId,
      project_code,
      project_name: project_name || project_code,
      options,
      status: 'running',
      current_phase: 'analyze',
      progress: { overall_percent: 0, analyze: 0, generate: 0, review: 0 },
      agent_context: {
        current_direction: '任务已创建，等待 Agent 启动…',
        current_phase: 'analyze',
        overall_percent: 0,
        generated_templates: [],
        llm_profile_id: llm_profile || '',
        updated_at: new Date().toISOString(),
      },
      import_status: 'pending',
      started_at: new Date(),
      created_by: this.ctx.state?.user?.id || null,
    });

    this.ctx.runInBackground(async () => {
      const bgCtx = this.app.createAnonymousContext();
      try {
        await bgCtx.service.apiTemplateGenerationJob.executeJob(job.id, jobPayload);
      } catch (err) {
        bgCtx.app.logger.error('[apiTemplateGenerationJob] background job=%s %s', job.id, err.message);
      }
    });

    return { job_id: job.id, id: job.id, status: 'running' };
  }

  async executeJob(jobId, payload) {
    const {
      document_id,
      project_code,
      project_name,
      options = {},
      document_content,
      llm_profile,
    } = payload;

    const job = await this.ctx.model.ApiTemplateGenerationJob.findByPk(jobId);
    if (!job || job.status === 'cancelled') return;

    const allSteps = [];

    try {
      const doc = await this.ctx.service.document.findById(document_id);
      if (!doc) throw new Error('document not found');

      const rawContent = document_content || doc.content;

      for (let pi = 0; pi < PHASES.length; pi++) {
        await job.reload();
        if (job.status === 'cancelled') return;

        const phase = PHASES[pi];
        await this.updateProgress(jobId, {
          phaseIndex: pi,
          direction: this.phaseLabel(phase),
          steps_log: allSteps,
        });
      }

      const agentRes = await this.ctx.service.agentProxy.invokeApiTemplate({
        action: 'generate',
        doc_id: document_id,
        doc_content: rawContent,
        doc_title: doc.title,
        document_content: rawContent,
        document_title: doc.title,
        project_code,
        project_name,
        hint: options.hint,
        options,
        job_id: jobId,
        llm_profile,
        trace: { job_id: jobId },
      });

      const rawTemplates = collectTemplatesFromOutput(agentRes.output || {});
      const approvedTemplates = normalizeAndDedupe(rawTemplates, project_code);

      const steps = agentRes.output?.steps || [];
      allSteps.push(...steps.map(s => ({
        ...s,
        template_count: approvedTemplates.length,
      })));

      if (!approvedTemplates.length) {
        throw new Error('Agent 未生成任何有效接口模板，请检查文档内容或调整备注后重试');
      }

      await job.update({
        status: 'done',
        current_phase: 'review',
        progress: { overall_percent: 100, analyze: 100, generate: 100, review: 100 },
        steps_log: allSteps,
        agent_context: {
          ...(job.agent_context || {}),
          generated_templates: approvedTemplates,
          templates_count: approvedTemplates.length,
          overall_percent: 100,
          current_direction: `生成完成，共 ${approvedTemplates.length} 条接口模板待确认导入`,
          updated_at: new Date().toISOString(),
        },
        finished_at: new Date(),
      });
    } catch (err) {
      await job.reload();
      if (job.status !== 'cancelled') {
        await job.update({
          status: 'failed',
          error_message: err.message,
          agent_context: {
            ...(job.agent_context || {}),
            current_direction: `执行失败：${err.message}`,
            updated_at: new Date().toISOString(),
          },
          finished_at: new Date(),
        });
      }
      this.ctx.app.logger.error('[apiTemplateGenerationJob] failed job=%s %s', jobId, err.message);
    }
  }

  phaseLabel(phase) {
    return {
      analyze: '文档分析',
      generate: '生成模板',
      review: '模板评审',
    }[phase] || phase;
  }

  async updateProgress(jobId, { phaseIndex, direction, steps_log }) {
    const overallPercent = Math.min(90, Math.round(((phaseIndex + 1) / PHASES.length) * 80));
    const phase = PHASES[Math.min(phaseIndex, PHASES.length - 1)] || 'review';

    const phaseProgress = Object.fromEntries(
      PHASES.map((p, i) => {
        if (i < phaseIndex) return [ p, 100 ];
        if (i === phaseIndex) return [ p, 50 ];
        return [ p, 0 ];
      }),
    );

    const row = await this.ctx.model.ApiTemplateGenerationJob.findByPk(jobId);
    if (!row) return;

    const updates = {
      current_phase: phase,
      progress: { overall_percent: overallPercent, ...phaseProgress },
      agent_context: {
        ...(row.agent_context || {}),
        overall_percent: overallPercent,
        current_phase: phase,
        current_direction: direction,
        updated_at: new Date().toISOString(),
      },
    };
    if (steps_log) updates.steps_log = steps_log;
    await row.update(updates);
  }

  async findById(id) {
    const row = await this.ctx.model.ApiTemplateGenerationJob.findByPk(id);
    if (!row) return null;
    const json = row.toJSON();
    return {
      id: json.id,
      status: json.status,
      current_phase: json.current_phase,
      progress: json.progress,
      steps: json.steps_log || [],
      error_message: json.error_message,
      agent_context: json.agent_context || {},
      document_id: json.document_id,
      project_code: json.project_code,
      project_name: json.project_name,
      options: json.options,
      import_status: json.import_status,
      imported_count: json.imported_count,
      started_at: json.started_at,
      finished_at: json.finished_at,
      updated_at: json.updated_at,
    };
  }

  async cancel(id) {
    const row = await this.ctx.model.ApiTemplateGenerationJob.findByPk(id);
    if (!row) return null;
    if ([ 'done', 'cancelled' ].includes(row.status)) {
      const err = new Error(`job cannot be cancelled in status: ${row.status}`);
      err.status = 400;
      throw err;
    }
    await row.update({
      status: 'cancelled',
      finished_at: new Date(),
      agent_context: {
        ...(row.agent_context || {}),
        current_direction: '任务已取消',
        updated_at: new Date().toISOString(),
      },
    });
    return this.findById(id);
  }

  async retry(id, options = {}) {
    const row = await this.ctx.model.ApiTemplateGenerationJob.findByPk(id);
    if (!row || row.status !== 'failed') {
      const err = new Error(`job cannot be retried in status: ${row?.status}`);
      err.status = 400;
      throw err;
    }

    const doc = await this.ctx.service.document.findById(row.document_id);
    const payload = {
      document_id: row.document_id,
      project_code: row.project_code,
      project_name: row.project_name,
      options: row.options,
      document_content: doc?.content,
      llm_profile: options.llm_profile,
    };

    await row.update({
      status: 'running',
      error_message: null,
      current_phase: 'analyze',
      progress: { overall_percent: 0, analyze: 0, generate: 0, review: 0 },
      import_status: 'pending',
      imported_count: 0,
      agent_context: {
        current_direction: '任务已重新提交…',
        generated_templates: [],
        overall_percent: 0,
        updated_at: new Date().toISOString(),
      },
      finished_at: null,
    });

    this.ctx.runInBackground(async () => {
      const bgCtx = this.app.createAnonymousContext();
      try {
        await bgCtx.service.apiTemplateGenerationJob.executeJob(id, payload);
      } catch (err) {
        bgCtx.app.logger.error('[apiTemplateGenerationJob] retry job=%s %s', id, err.message);
      }
    });

    return this.findById(id);
  }

  async updateAgentContext(id, patch = {}) {
    const row = await this.ctx.model.ApiTemplateGenerationJob.findByPk(id);
    if (!row) return null;

    const merged = {
      ...(row.agent_context || {}),
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const updates = { agent_context: merged };
    if (patch.overall_percent != null) {
      updates.progress = {
        ...(row.progress || {}),
        overall_percent: patch.overall_percent,
      };
    }
    if (patch.current_phase) {
      updates.current_phase = patch.current_phase;
    }
    if (patch.generated_templates) {
      merged.generated_templates = normalizeAndDedupe(
        patch.generated_templates,
        row.project_code,
      );
      merged.templates_count = merged.generated_templates.length;
    }

    await row.update(updates);
    return this.findById(id);
  }

  async confirmImport(id, body = {}) {
    const row = await this.ctx.model.ApiTemplateGenerationJob.findByPk(id);
    if (!row) return null;
    if (row.status !== 'done') {
      const err = new Error('仅已完成的任务可导入');
      err.status = 400;
      throw err;
    }
    if (row.import_status === 'imported') {
      const err = new Error('该任务已导入，不可重复导入');
      err.status = 400;
      throw err;
    }

    const allTemplates = row.agent_context?.generated_templates || [];
    const selectedCodes = Array.isArray(body.template_codes) ? body.template_codes : null;
    const toImport = selectedCodes?.length
      ? allTemplates.filter(t => selectedCodes.includes(t.template_code))
      : allTemplates;

    if (!toImport.length) {
      const err = new Error('没有可导入的接口模板');
      err.status = 400;
      throw err;
    }

    const created = [];
    const skipped = [];

    for (const draft of toImport) {
      try {
        const existing = await this.ctx.model.FtApiTemplate.findOne({
          where: { template_code: draft.template_code, is_active: true },
        });
        if (existing && !body.overwrite) {
          skipped.push({ template_code: draft.template_code, reason: '编码已存在' });
          continue;
        }
        if (existing && body.overwrite) {
          await this.ctx.service.apiTemplate.update(existing.id, draft);
          created.push({ id: existing.id, template_code: draft.template_code, action: 'updated' });
        } else {
          const row2 = await this.ctx.service.apiTemplate.create(draft);
          created.push({ id: row2.id, template_code: draft.template_code, action: 'created' });
        }
      } catch (err) {
        skipped.push({ template_code: draft.template_code, reason: err.message });
      }
    }

    await row.update({
      import_status: created.length ? 'imported' : 'failed',
      imported_count: created.length,
      agent_context: {
        ...(row.agent_context || {}),
        import_result: { created, skipped },
        updated_at: new Date().toISOString(),
      },
    });

    return {
      imported: created.length,
      skipped: skipped.length,
      created,
      skipped,
    };
  }
}

module.exports = ApiTemplateGenerationJobService;
