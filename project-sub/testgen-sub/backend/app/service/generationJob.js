'use strict';

const Service = require('egg').Service;

const PHASES = [ 'analyze', 'functional', 'edge', 'review' ];
const FIELD_MAX = 300;

class GenerationJobService extends Service {
  async createAndRun(payload) {
    const {
      staging_id,
      document_id,
      document_content,
      document_title,
      document_type,
      module,
      test_types,
      options,
      llm_profile,
    } = payload;

    if (!module) {
      const err = new Error('module is required');
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
        metadata: { module },
      });
      resolvedDocumentId = doc.id;
    }

    const jobPayload = {
      document_id: resolvedDocumentId,
      module,
      test_types,
      options,
      document_content: resolvedContent,
      document_title: resolvedTitle,
      document_type: resolvedType,
      llm_profile,
    };

    const job = await this.ctx.model.GenerationJob.create({
      document_id: resolvedDocumentId,
      module,
      test_types: test_types || [],
      options: options || {},
      status: 'running',
      current_phase: 'analyze',
      progress: { analyze: 10, functional: 0, edge: 0, review: 0 },
      agent_context: {
        current_direction: '任务已创建，等待 Agent 启动…',
        current_phase: 'analyze',
        llm_profile_id: llm_profile || '',
        type_counts: options?.type_counts || {},
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

    return {
      job_id: job.id,
      id: job.id,
      status: 'running',
    };
  }

  async executeJob(jobId, payload) {
    const { document_id, module, test_types, options, document_content, llm_profile } = payload;
    const job = await this.ctx.model.GenerationJob.findByPk(jobId);
    if (!job) return;

    if (job.status === 'cancelled') return;

    let progressTimer = null;
    let phaseIndex = 0;
    let agentRes = null;

    const updateProgress = async (phaseIdx, percent) => {
      const progress = Object.fromEntries(
        PHASES.map((p, i) => [ p, i < phaseIdx ? 100 : (i === phaseIdx ? percent : 0) ]),
      );
      await job.update({
        current_phase: PHASES[phaseIdx],
        progress,
      });
    };

    try {
      const doc = await this.ctx.service.document.findById(document_id);
      if (!doc) {
        const err = new Error('document not found');
        err.status = 404;
        throw err;
      }

      await updateProgress(0, 25);
      await this.updateAgentContext(jobId, {
        current_direction: '正在连接 Agent 平台…',
        current_phase: 'analyze',
        llm_profile_id: llm_profile || job.agent_context?.llm_profile_id || '',
      });

      progressTimer = setInterval(async () => {
        try {
          await job.reload();
          if ([ 'cancelled', 'done', 'failed' ].includes(job.status)) return;
          phaseIndex = Math.min(phaseIndex + 1, PHASES.length - 1);
          const percent = Math.min(25 + phaseIndex * 20, 90);
          await updateProgress(phaseIndex, percent);
        } catch (e) {
          this.ctx.app.logger.warn('[generationJob] progress tick failed job=%s %s', jobId, e.message);
        }
      }, 3000);

      const rawContent = document_content || doc.content;

      agentRes = await this.ctx.service.agentProxy.invokeTestgen({
        action: 'generate',
        doc_id: document_id,
        doc_title: doc.title,
        document_content: rawContent,
        module,
        test_types: test_types || [],
        options: options || {},
        job_id: jobId,
        llm_profile,
      });

      if (progressTimer) clearInterval(progressTimer);

      await job.reload();
      if (job.status === 'cancelled') return;

      await this.syncFromAgentOutput(jobId, agentRes, document_id, module);

      const caseCount = await this.ctx.model.TestCase.count({ where: { job_id: jobId } });
      if (caseCount === 0) {
        throw new Error('Agent 执行完成但未返回可落库的测试用例，请检查文档内容或重试');
      }

      await job.update({
        status: 'done',
        current_phase: 'review',
        progress: { analyze: 100, functional: 100, edge: 100, review: 100 },
        finished_at: new Date(),
      });
    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      await job.reload();
      if (job.status !== 'cancelled') {
        const abnormal = this.buildAbnormalDetail(agentRes, err.message);
        await job.update({
          status: 'failed',
          error_message: err.message,
          agent_context: {
            ...(job.agent_context || {}),
            current_direction: `执行失败：${err.message}`,
            abnormal_content: abnormal,
            updated_at: new Date().toISOString(),
          },
          finished_at: new Date(),
        });
      }
      this.ctx.app.logger.error('[generationJob] failed job=%s %s', jobId, err.message);
    }
  }

  async retry(id, options = {}) {
    const row = await this.ctx.model.GenerationJob.findByPk(id);
    if (!row) return null;
    if (row.status !== 'failed') {
      const err = new Error(`job cannot be retried in status: ${row.status}`);
      err.status = 400;
      throw err;
    }

    const payload = {
      document_id: row.document_id,
      module: row.module,
      test_types: row.test_types,
      options: row.options,
      llm_profile: options.llm_profile,
    };

    await row.update({
      status: 'running',
      error_message: null,
      current_phase: 'analyze',
      progress: { analyze: 10, functional: 0, edge: 0, review: 0 },
      agent_context: {
        current_direction: '任务已重新提交，等待 Agent 启动…',
        current_phase: 'analyze',
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

  async updateAgentContext(id, patch = {}) {
    const row = await this.ctx.model.GenerationJob.findByPk(id);
    if (!row) return null;

    const merged = {
      ...(row.agent_context || {}),
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const updates = { agent_context: merged };
    if (patch.current_phase && PHASES.includes(patch.current_phase)) {
      updates.current_phase = patch.current_phase;
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
    await row.update({
      status: 'cancelled',
      finished_at: new Date(),
    });
    return this.findById(id);
  }

  async syncFromAgentOutput(jobId, agentRes, documentId, jobModule) {
    const { output = {}, meta = {} } = agentRes;
    const steps = output.steps || [];
    const progress = this.phasesToProgress(steps);
    const rawCases = this.collectTestCasesFromOutput(output);
    const usedCaseIds = new Set();
    const cases = rawCases.map((tc, index) =>
      this.normalizeTestCase(tc, jobId, documentId, jobModule, usedCaseIds, index),
    );

    const tx = await this.ctx.model.transaction();
    try {
      const row = await this.ctx.model.GenerationJob.findByPk(jobId, { transaction: tx });
      const mergedContext = {
        ...(row?.agent_context || {}),
        model: meta.model || row?.agent_context?.model || '',
        llm_profile_id: meta.llm_profile_id || agentRes.llm_profile_id || row?.agent_context?.llm_profile_id || '',
        current_direction: cases.length
          ? `Agent 执行完成，正在写入 ${cases.length} 条用例…`
          : 'Agent 执行完成，但未解析到测试用例',
        updated_at: new Date().toISOString(),
      };
      if (!cases.length) {
        mergedContext.abnormal_content = this.buildAbnormalDetail(agentRes);
      }

      await this.ctx.model.GenerationJob.update(
        {
          agent_run_id: meta.run_id || null,
          progress,
          current_phase: this.resolveCurrentPhase(progress, steps),
          agent_context: mergedContext,
          steps_log: steps.map(s => ({
            phase: s.phase || s.state?.phase,
            note: s.note || s.partialOutput || s.state?.note?.[0] || '',
            test_case_count: (s.state?.testCases || s.testCases || []).length,
          })),
        },
        { where: { id: jobId }, transaction: tx },
      );
      if (cases.length) {
        await this.ctx.model.TestCase.bulkCreate(cases, { transaction: tx });
      } else {
        this.ctx.app.logger.warn('[generationJob] job=%s agent returned 0 test cases', jobId);
      }
      await tx.commit();
      return { caseCount: cases.length };
    } catch (e) {
      await tx.rollback();
      this.ctx.app.logger.error('[generationJob] syncFromAgentOutput job=%s %s', jobId, e.message);
      throw e;
    }
  }

  buildAbnormalDetail(agentRes, errorMessage = '') {
    const parts = [];
    if (errorMessage) parts.push(`【BFF 错误】${errorMessage}`);

    const output = agentRes?.output || {};
    const reply = agentRes?.reply || '';
    if (output.stoppedReason) {
      parts.push(`【Agent 停止原因】${output.stoppedReason}`);
    }
    if (reply && output.stoppedReason === 'llm_error') {
      parts.push(`【Agent 回复】\n${reply}`);
    }

    const rawCases = this.collectTestCasesFromOutput(output);
    if (!rawCases.length) {
      parts.push(
        '【落库诊断】未从 Agent 输出中解析到 testCases / test_cases 数组。',
        '常见原因：',
        '1. LLM 输出 JSON 被截断或格式非法（检查 maxTokens 是否足够）',
        '2. 用例只写在 note/summary 文本中，未放入 testCases 数组',
        '3. phase 未随步序推进（functional/edge 步未产出用例）',
        '4. 历史 memory 干扰导致模型提前 done（已对 generate 禁用 memory）',
      );
    }

    if (output.summary) {
      parts.push(`【Agent summary】\n${output.summary}`);
    }
    if (output.coverage_notes) {
      parts.push(`【覆盖说明】\n${output.coverage_notes}`);
    }

    const steps = output.steps || [];
    const tailSteps = steps.slice(-3);
    for (const step of tailSteps) {
      const label = step.step != null ? `步骤 ${step.step}` : '步骤';
      const phase = step.phase || step.state?.phase || '—';
      if (step.parseWarning) {
        parts.push(`【${label} 解析警告】${step.parseWarning}`);
      }
      const partial = step.partialOutput || step.note || '';
      if (partial) {
        parts.push(`【${label} phase=${phase} 摘要】\n${partial}`);
      }
      const rawSnippet = String(step.rawText || '').slice(0, 1500);
      if (rawSnippet && !rawCases.length) {
        parts.push(`【${label} 原始 LLM 输出（前 1500 字）】\n${rawSnippet}`);
      }
      const batch = step.state?.testCases || step.state?.test_cases || [];
      if (Array.isArray(batch) && !batch.length) {
        parts.push(`【${label}】phase=${phase}，testCases 为空`);
      }
    }

    return parts.filter(Boolean).join('\n\n') || errorMessage || '未知异常';
  }

  collectTestCasesFromOutput(output = {}) {
    if (Array.isArray(output.testCases) && output.testCases.length) {
      return output.testCases;
    }
    if (Array.isArray(output.test_cases) && output.test_cases.length) {
      return output.test_cases;
    }
    const merged = [];
    for (const step of output.steps || []) {
      const batch = step.state?.testCases || step.state?.test_cases
        || step.testCases || step.test_cases || [];
      if (Array.isArray(batch)) merged.push(...batch);
    }
    return merged;
  }

  truncateField(value, max = FIELD_MAX) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (text.length <= max) return text;
    return `${text.slice(0, max)}…`;
  }

  normalizePriority(priority) {
    const raw = String(priority || 'medium').toLowerCase();
    const map = {
      high: 'high', h: 'high', 高: 'high',
      medium: 'medium', m: 'medium', 中: 'medium',
      low: 'low', l: 'low', 低: 'low',
    };
    if (map[raw]) return map[raw];
    if (raw.includes('高')) return 'high';
    if (raw.includes('低')) return 'low';
    return 'medium';
  }

  normalizeConfidence(value) {
    if (value == null || value === '') return 0;
    let n = Number(value);
    if (Number.isNaN(n)) return 0;
    if (n > 1) n /= 100;
    return Math.min(1, Math.max(0, n));
  }

  normalizeStatus(status) {
    const allowed = [ 'pending', 'running', 'passed', 'failed' ];
    const raw = String(status || 'pending').toLowerCase();
    return allowed.includes(raw) ? raw : 'pending';
  }

  uniqueCaseId(base, usedIds) {
    let id = this.truncateField(base, 64) || `TC-${Date.now()}`;
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    let n = 2;
    while (usedIds.has(`${id}-${n}`)) n += 1;
    const next = `${id}-${n}`;
    usedIds.add(next);
    return next;
  }

  normalizeTestCase(tc, jobId, documentId, jobModule, usedCaseIds, index) {
    const baseId = tc.case_id || tc.caseId || tc.id || `TC-${jobId}-${index + 1}`;
    const stepsRaw = Array.isArray(tc.steps) ? tc.steps : (tc.steps ? [ tc.steps ] : []);
    const steps = stepsRaw.map(s => {
      if (typeof s === 'string') return this.truncateField(s);
      if (s && typeof s === 'object') {
        return this.truncateField(s.action || s.step || JSON.stringify(s));
      }
      return this.truncateField(String(s));
    }).filter(Boolean);

    return {
      job_id: jobId,
      document_id: documentId,
      case_id: this.uniqueCaseId(baseId, usedCaseIds),
      title: this.truncateField(tc.title || tc.name || '未命名用例', 255),
      module: this.truncateField(tc.module || jobModule || '', 64) || null,
      type: this.truncateField(tc.type || 'functional', 32),
      priority: this.normalizePriority(tc.priority),
      status: this.normalizeStatus(tc.status),
      confidence: this.normalizeConfidence(tc.confidence),
      compliance: this.truncateField(tc.compliance || 'unverified', 32),
      preconditions: this.truncateField(tc.preconditions || tc.precondition || '') || null,
      steps: steps.length ? steps : [ '待补充步骤' ],
      expected: this.truncateField(tc.expected || tc.expected_result || '') || null,
      tags: Array.isArray(tc.tags)
        ? tc.tags.map(t => this.truncateField(t, 64)).filter(Boolean)
        : [],
    };
  }

  resolveCurrentPhase(progress, steps = []) {
    for (let i = PHASES.length - 1; i >= 0; i -= 1) {
      if ((progress[PHASES[i]] || 0) > 0) return PHASES[i];
    }
    const lastStep = steps[steps.length - 1];
    const last = lastStep?.phase || lastStep?.state?.phase;
    if (PHASES.includes(last)) return last;
    return 'analyze';
  }

  phasesToProgress(steps) {
    const progress = Object.fromEntries(PHASES.map(p => [ p, 0 ]));
    for (const step of steps) {
      const phase = step.phase || step.state?.phase;
      if (PHASES.includes(phase)) progress[phase] = 100;
    }
    if (steps.length) {
      const lastStep = steps[steps.length - 1];
      const last = lastStep.phase || lastStep.state?.phase;
      if (PHASES.includes(last) && progress[last] < 100) progress[last] = 50;
    }
    return progress;
  }
}

module.exports = GenerationJobService;
