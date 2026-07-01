'use strict';

const Service = require('egg').Service;
const { isApprovedCase, auditItemDetailFields, normalizeCaseFields } = require('../lib/generationItemMapper');
const { buildSchemeTargetsFromMajors } = require('../lib/generationTemplateHelper');
const {
  buildFitnessPrimaryContextText,
  buildTemplateOutputFormatText,
} = require('../lib/templateOutputFormats');

const PHASES = [ 'analyze', 'generate', 'review' ];
const MAX_TARGET_ATTEMPTS = 5;

class GenerationJobService extends Service {
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

    let scheme_targets = options.scheme_targets || [];
    const category_major_ids = options.category_major_ids?.length
      ? options.category_major_ids
      : (options.category_major_id ? [ options.category_major_id ] : []);

    if (!project_code || !project_name) {
      const err = new Error('project_code 与 project_name 为必填项');
      err.status = 400;
      throw err;
    }
    if (!category_major_ids.length) {
      const err = new Error('请至少选择一个测试大类');
      err.status = 400;
      throw err;
    }

    if (!scheme_targets.length) {
      scheme_targets = await buildSchemeTargetsFromMajors(this.app, {
        category_major_ids,
        validation_ids: options.validation_ids,
        major_counts: options.major_counts,
        default_count: options.default_count || 5,
      });
      options.scheme_targets = scheme_targets;
      options.category_major_ids = category_major_ids;
    }

    if (!scheme_targets.length) {
      const err = new Error('无法根据所选大类解析生成目标，请检查大类与验证配置');
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
      project_name,
      options,
      document_content: resolvedContent,
      document_title: resolvedTitle,
      document_type: resolvedType,
      llm_profile,
    };

    const job = await this.ctx.model.GenerationJob.create({
      document_id: resolvedDocumentId,
      module: project_name,
      project_code,
      project_name,
      test_types: [],
      options,
      status: 'running',
      current_phase: 'analyze',
      progress: { overall_percent: 0, analyze: 0, generate: 0, review: 0 },
      agent_context: {
        current_direction: '任务已创建，等待 Agent 启动…',
        current_phase: 'analyze',
        current_target_index: 0,
        current_target: scheme_targets[0],
        scheme_targets,
        target_states: scheme_targets.map(t => ({
          ...t,
          status: 'pending',
          produced: 0,
        })),
        overall_percent: 0,
        llm_profile_id: llm_profile || '',
        updated_at: new Date().toISOString(),
      },
      started_at: new Date(),
      created_by: this.ctx.state?.user?.id || null,
    });

    this.ctx.runInBackground(async () => {
      const bgCtx = this.app.createAnonymousContext();
      try {
        await bgCtx.service.generationJob.executeJob(job.id, jobPayload);
      } catch (err) {
        bgCtx.app.logger.error('[generationJob] background job=%s %s', job.id, err.message);
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

    const job = await this.ctx.model.GenerationJob.findByPk(jobId);
    if (!job || job.status === 'cancelled') return;

    const scheme_targets = options.scheme_targets || job.options?.scheme_targets || [];
    const targetStates = scheme_targets.map(t => ({ ...t, status: 'pending', produced: 0 }));
    const allSteps = [];
    let totalItems = 0;

    try {
      const doc = await this.ctx.service.document.findById(document_id);
      if (!doc) throw new Error('document not found');

      const rawContent = document_content || doc.content;

      for (let ti = 0; ti < scheme_targets.length; ti++) {
        await job.reload();
        if (job.status === 'cancelled') return;

        const target = scheme_targets[ti];
        targetStates[ti].status = 'running';
        let approvedCases = [];
        let attempts = 0;

        while (approvedCases.length < target.count && attempts < MAX_TARGET_ATTEMPTS) {
          attempts += 1;
          await job.reload();
          if (job.status === 'cancelled') return;

          for (let pi = 0; pi < PHASES.length; pi++) {
            const phase = PHASES[pi];
            await this.updateSchemeProgress(jobId, {
              targetIndex: ti,
              phaseIndex: pi,
              target,
              targetStates,
              scheme_targets,
              direction: `${target.scheme_name || target.scheme_id} · ${target.validation_name || target.validation_id} — ${this.phaseLabel(phase)}`,
            });
          }

          const agentRes = await this.ctx.service.agentProxy.invokeTestgen({
            action: 'generate_for_fitness',
            doc_id: document_id,
            doc_content: rawContent,
            doc_title: doc.title,
            document_content: rawContent,
            document_title: doc.title,
            module: project_name,
            project_code,
            project_name,
            test_types: [ '功能测试', '边界值测试' ],
            options: {
              ...options,
              hint: options.hint,
              category_major_id: target.category_major_id,
              type_counts: {
                '功能测试': target.count,
                '边界值测试': target.count,
              },
              scheme_target: target,
            },
            fitness_context: {
              scheme_id: target.scheme_id,
              validation_id: target.validation_id,
              category_major_id: target.category_major_id,
              template_code: target.template_code,
            },
            fitness_primary_context: buildFitnessPrimaryContextText(target),
            template_output_format: buildTemplateOutputFormatText(target.template_code),
            scheme_id: target.scheme_id,
            validation_id: target.validation_id,
            template_code: target.template_code,
            job_id: jobId,
            llm_profile,
            trace: { job_id: jobId },
          });

          const rawCases = this.collectTestCasesFromOutput(agentRes.output || {});
          const batchApproved = rawCases.filter(tc => isApprovedCase(normalizeCaseFields(tc)));
          if (rawCases.length && !batchApproved.length) {
            const sample = auditItemDetailFields(normalizeCaseFields(rawCases[0]));
            this.ctx.app.logger.warn(
              '[generationJob] job=%s target=%s attempt=%s raw=%s approved=0 sample_errors=%j',
              jobId, target.scheme_id, attempts, rawCases.length, sample.errors,
            );
          }
          approvedCases.push(...batchApproved);

          const steps = agentRes.output?.steps || [];
          allSteps.push(...steps.map(s => ({
            ...s,
            scheme_id: target.scheme_id,
            validation_id: target.validation_id,
            attempt: attempts,
            test_case_count: batchApproved.length,
          })));

          targetStates[ti].produced = approvedCases.length;
          targetStates[ti].attempt = attempts;
          targetStates[ti].last_batch_approved = batchApproved.length;

          const targetLabel = `${target.scheme_name || target.scheme_id} · ${target.validation_name || target.validation_id}`;
          let retryNotice = null;
          let direction = '';

          if (batchApproved.length === 0) {
            targetStates[ti].last_attempt_empty = true;
            retryNotice = `第 ${attempts} 次生成：${targetLabel} 字段校验后无有效用例`;
            const willRetry = approvedCases.length < target.count && attempts < MAX_TARGET_ATTEMPTS;
            direction = willRetry
              ? `${retryNotice}，正在重试…（已通过 ${approvedCases.length}/${target.count} 条）`
              : `${retryNotice}（已通过 ${approvedCases.length}/${target.count} 条）`;
          } else if (approvedCases.length < target.count) {
            targetStates[ti].last_attempt_empty = false;
            retryNotice = null;
            const willRetry = attempts < MAX_TARGET_ATTEMPTS;
            direction = willRetry
              ? `${targetLabel}：已通过 ${approvedCases.length}/${target.count} 条，继续补全…`
              : `${targetLabel}：已通过 ${approvedCases.length}/${target.count} 条`;
          } else {
            targetStates[ti].last_attempt_empty = false;
            retryNotice = null;
            direction = `${targetLabel}：已通过 ${approvedCases.length}/${target.count} 条`;
          }

          if (approvedCases.length < target.count) {
            await this.updateSchemeProgress(jobId, {
              targetIndex: ti,
              phaseIndex: PHASES.length - 1,
              target,
              targetStates,
              scheme_targets,
              direction,
              steps_log: allSteps,
              retry_notice: retryNotice,
            });
            this.ctx.app.logger.warn(
              '[generationJob] job=%s target=%s attempt=%s approved=%s need=%s batch=%s',
              jobId, target.scheme_id, attempts, approvedCases.length, target.count, batchApproved.length,
            );
          } else {
            await this.updateSchemeProgress(jobId, {
              targetIndex: ti,
              phaseIndex: PHASES.length - 1,
              target,
              targetStates,
              scheme_targets,
              direction,
              steps_log: allSteps,
              retry_notice: null,
            });
          }
        }

        approvedCases = approvedCases.slice(0, target.count);

        if (!approvedCases.length) {
          targetStates[ti].status = 'failed';
          targetStates[ti].produced = 0;
          await this.updateSchemeProgress(jobId, {
            targetIndex: ti,
            phaseIndex: PHASES.length,
            target,
            targetStates,
            scheme_targets,
            direction: `${target.scheme_name || target.scheme_id} · ${target.validation_name || target.validation_id}：未生成任何通过字段校验的用例`,
            steps_log: allSteps,
            retry_notice: `${target.scheme_name || target.scheme_id} · ${target.validation_name || target.validation_id} 在 ${attempts} 次尝试后仍无有效用例`,
          });
          continue;
        }

        const itemIds = await this.ctx.service.generationItemWriter.bulkInsertItems(
          approvedCases,
          {
            job_id: jobId,
            project_code,
            project_name,
            scheme_id: target.scheme_id,
            validation_id: target.validation_id,
            category_major_id: target.category_major_id,
            category_minor_id: target.category_minor_id,
            dimension_id: target.dimension_id,
            template_code: target.template_code,
          },
        );

        totalItems += itemIds.length;
        targetStates[ti].status = 'done';
        targetStates[ti].produced = itemIds.length;

        await this.updateSchemeProgress(jobId, {
          targetIndex: ti,
          phaseIndex: PHASES.length,
          target,
          targetStates,
          scheme_targets,
          direction: `${target.scheme_name || target.scheme_id} 已完成，写入 ${itemIds.length} 条`,
          steps_log: allSteps,
          retry_notice: null,
        });
      }

      if (totalItems === 0) {
        throw new Error('全部生成目标均未产出通过字段校验的有效用例，请检查文档内容或调整生成配置后重试');
      }

      await job.update({
        status: 'done',
        current_phase: 'review',
        progress: { overall_percent: 100, analyze: 100, generate: 100, review: 100 },
        steps_log: allSteps,
        agent_context: {
          ...(job.agent_context || {}),
          target_states: targetStates,
          overall_percent: 100,
          retry_notice: null,
          current_direction: `全部完成，共写入 ${totalItems} 条测试项`,
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
            target_states: targetStates,
            current_direction: `执行失败：${err.message}`,
            updated_at: new Date().toISOString(),
          },
          finished_at: new Date(),
        });
      }
      this.ctx.app.logger.error('[generationJob] failed job=%s %s', jobId, err.message);
    }
  }

  normalizePhase(phase) {
    if (phase === 'functional' || phase === 'edge') return 'generate';
    return phase;
  }

  phaseLabel(phase) {
    const key = this.normalizePhase(phase);
    return {
      analyze: '需求分析',
      generate: '生成用例',
      review: '字段合规',
    }[key] || key;
  }

  async updateSchemeProgress(jobId, {
    targetIndex,
    phaseIndex,
    target,
    targetStates,
    scheme_targets,
    direction,
    steps_log,
    retry_notice,
  }) {
    const totalSteps = scheme_targets.length * PHASES.length;
    const completedSteps = targetIndex * PHASES.length + Math.min(phaseIndex, PHASES.length);
    const overallPercent = Math.min(99, Math.round((completedSteps / totalSteps) * 100));
    const phase = PHASES[Math.min(phaseIndex, PHASES.length - 1)] || 'review';

    const phaseProgress = Object.fromEntries(
      PHASES.map((p, i) => {
        if (i < phaseIndex) return [ p, 100 ];
        if (i === phaseIndex) return [ p, 50 ];
        return [ p, 0 ];
      }),
    );

    const row = await this.ctx.model.GenerationJob.findByPk(jobId);
    if (!row) return;

    const updates = {
      current_phase: phase,
      progress: { overall_percent: overallPercent, ...phaseProgress },
      agent_context: {
        ...(row.agent_context || {}),
        current_target_index: targetIndex,
        current_target: target,
        target_states: targetStates,
        scheme_targets,
        overall_percent: overallPercent,
        current_phase: phase,
        current_direction: direction,
        retry_notice: retry_notice !== undefined ? retry_notice : (row.agent_context?.retry_notice ?? null),
        updated_at: new Date().toISOString(),
      },
    };
    if (steps_log) updates.steps_log = steps_log;
    await row.update(updates);
  }

  async retry(id, options = {}) {
    const row = await this.ctx.model.GenerationJob.findByPk(id);
    if (!row || row.status !== 'failed') {
      const err = new Error(`job cannot be retried in status: ${row?.status}`);
      err.status = 400;
      throw err;
    }

    const payload = {
      document_id: row.document_id,
      project_code: row.project_code,
      project_name: row.project_name,
      options: row.options,
      llm_profile: options.llm_profile,
    };

    await row.update({
      status: 'running',
      error_message: null,
      current_phase: 'analyze',
      progress: { overall_percent: 0, analyze: 0, generate: 0, review: 0 },
      agent_context: {
        current_direction: '任务已重新提交…',
        scheme_targets: row.options?.scheme_targets || [],
        overall_percent: 0,
        updated_at: new Date().toISOString(),
      },
      finished_at: null,
    });

    this.ctx.runInBackground(async () => {
      const bgCtx = this.app.createAnonymousContext();
      try {
        await bgCtx.service.generationJob.executeJob(id, payload);
      } catch (err) {
        bgCtx.app.logger.error('[generationJob] retry job=%s %s', id, err.message);
      }
    });

    return this.findById(id);
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
      agent_context: json.agent_context || {},
      document_id: json.document_id,
      project_code: json.project_code,
      project_name: json.project_name,
      module: json.module,
      test_types: json.test_types,
      options: json.options,
      started_at: json.started_at,
      finished_at: json.finished_at,
      updated_at: json.updated_at,
    };
  }

  async listGeneratedItems(jobId, { page = 1, pageSize = 20 } = {}) {
    const offset = (Number(page) - 1) * Number(pageSize);
    const [ countRows ] = await this.app.model.query(
      'SELECT COUNT(*) AS total FROM test_item_detail WHERE generation_job_id = :jobId',
      { replacements: { jobId: Number(jobId) } },
    );
    const total = Number(countRows[0]?.total || 0);
    const [ rows ] = await this.app.model.query(
      `SELECT item_id, item_name, detail_summary, scheme_primary_id, validation_primary_id,
              priority_id, project_code, project_name, category_major_id, template_code, created_at
       FROM test_item_detail WHERE generation_job_id = :jobId
       ORDER BY item_id LIMIT :limit OFFSET :offset`,
      { replacements: { jobId: Number(jobId), limit: Number(pageSize), offset } },
    );
    return { list: rows, total, page: Number(page), pageSize: Number(pageSize) };
  }

  async updateAgentContext(id, patch = {}) {
    const row = await this.ctx.model.GenerationJob.findByPk(id);
    if (!row) return null;
    const merged = { ...(row.agent_context || {}), ...patch, updated_at: new Date().toISOString() };
    const updates = { agent_context: merged };
    if (patch.current_phase) {
      const phase = this.normalizePhase(patch.current_phase);
      if (PHASES.includes(phase)) {
        updates.current_phase = phase;
        merged.current_phase = phase;
      }
    }
    await row.update(updates);
    return merged;
  }

  async cancel(id) {
    const row = await this.ctx.model.GenerationJob.findByPk(id);
    if (!row) return null;
    if ([ 'done', 'failed', 'cancelled' ].includes(row.status)) {
      const err = new Error(`job cannot be cancelled in status: ${row.status}`);
      err.status = 400;
      throw err;
    }
    await row.update({ status: 'cancelled', finished_at: new Date() });
    return this.findById(id);
  }

  collectTestCasesFromOutput(output = {}) {
    /** @type {unknown[][]} */
    const batches = [];
    if (Array.isArray(output.testCases) && output.testCases.length) batches.push(output.testCases);
    if (Array.isArray(output.test_cases) && output.test_cases.length) batches.push(output.test_cases);
    for (const step of output.steps || []) {
      const batch = step.state?.testCases || step.state?.test_cases
        || step.testCases || step.test_cases || [];
      if (Array.isArray(batch) && batch.length) batches.push(batch);
    }
    if (!batches.length) return [];

    let best = batches[batches.length - 1];
    let bestApproved = 0;
    for (const batch of batches) {
      const approved = batch.filter(tc => isApprovedCase(normalizeCaseFields(tc))).length;
      if (approved > bestApproved) {
        bestApproved = approved;
        best = batch;
      }
    }
    return best;
  }

  buildAbnormalDetail(agentRes, errorMessage = '') {
    const parts = errorMessage ? [ `【BFF 错误】${errorMessage}` ] : [];
    const output = agentRes?.output || {};
    if (output.summary) parts.push(`【Agent summary】\n${output.summary}`);
    return parts.join('\n\n') || errorMessage || '未知异常';
  }
}

module.exports = GenerationJobService;
