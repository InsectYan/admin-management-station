'use strict';

const Service = require('egg').Service;
const { isApprovedCase, auditItemDetailFields, normalizeCaseFields } = require('../lib/generationItemMapper');
const { buildSchemeTargetsFromMajors } = require('../lib/generationTemplateHelper');
const {
  buildFitnessPrimaryContextText,
  buildTemplateOutputFormatText,
  buildExistingCasesContextText,
} = require('../lib/templateOutputFormats');

const PHASES = [ 'analyze', 'generate', 'review' ];
/** @deprecated 不再限制轮次上限，补生成直至达目标条数 */
const MAX_BATCH_ATTEMPTS = 9999;
const ROUND_SIZE_LOCAL = 5;
const ROUND_SIZE_CLOUD = 10;
const ESTIMATE_MAX_TOTAL = 120;
const DEFAULT_ESTIMATE_TIMEOUT_MS = 60000;

function isLocalOllamaProfile(profileId) {
  const id = String(profileId || 'ollama-qwen').trim().toLowerCase();
  return !profileId || id.startsWith('ollama') || id === 'env-fallback';
}

/** 每轮固定请求条数：本地 5，云端 10（与剩余条数无关） */
function roundRequestSize(llmProfile) {
  return isLocalOllamaProfile(llmProfile) ? ROUND_SIZE_LOCAL : ROUND_SIZE_CLOUD;
}

function caseDedupeKey(tc) {
  const n = normalizeCaseFields(tc);
  const name = String(n.item_name || '').trim().toLowerCase();
  const summary = String(n.detail_summary || '').trim().toLowerCase();
  return name || summary ? `${name}::${summary}` : '';
}

/** 逐条合规审查：通过的保留，未通过的记录原因 */
function reviewCasesIndividually(cases) {
  const approved = [];
  const rejected = [];
  for (const tc of cases) {
    const audit = auditItemDetailFields(normalizeCaseFields(tc));
    if (audit.valid) {
      approved.push(audit.normalized);
    } else {
      rejected.push({
        item_name: String(audit.normalized?.item_name || tc?.item_name || tc?.title || '—'),
        errors: audit.errors,
      });
    }
  }
  return { approved, rejected };
}

function summarizeExistingCases(cases) {
  return cases.map(tc => {
    const n = normalizeCaseFields(tc);
    return {
      item_name: n.item_name,
      detail_summary: n.detail_summary,
      expected_observation: n.expected_observation,
    };
  });
}

/** 从候选中挑选未重复且通过校验的用例，最多 limit 条；registerKeys=false 时不写入 seenKeys */
function pickUniqueApprovedCases(candidates, seenKeys, limit, registerKeys = true) {
  const picked = [];
  for (const tc of candidates) {
    if (picked.length >= limit) break;
    const normalized = normalizeCaseFields(tc);
    if (!isApprovedCase(normalized)) continue;
    const key = caseDedupeKey(tc);
    if (key && seenKeys.has(key)) continue;
    if (key && registerKeys) seenKeys.add(key);
    picked.push(tc);
  }
  return picked;
}

function registerCaseKeys(cases, seenKeys) {
  for (const tc of cases) {
    const key = caseDedupeKey(tc);
    if (key) seenKeys.add(key);
  }
}

function batchCountForTarget(count, roundSize = ROUND_SIZE_CLOUD) {
  return Math.max(1, Math.ceil(Number(count || 0) / roundSize));
}

function countUniqueMatches(text, pattern, normalize) {
  const matches = text.match(pattern) || [];
  const seen = new Set();
  for (const raw of matches) {
    const value = (normalize ? normalize(raw) : raw).toLowerCase();
    if (value) seen.add(value);
  }
  return seen.size;
}

function normalizeEndpointPath(path) {
  return String(path || '')
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '')
    .trim();
}

function isLlmUnavailableError(err) {
  const msg = String(err?.message || err || '');
  return /402|Insufficient Balance|余额不足|LLM 错误|llm_error/i.test(msg);
}

function formatAgentEstimateWarning(err) {
  const brief = String(err?.message || '超时').split('\n')[0].slice(0, 160);
  if (/402|Insufficient Balance|余额不足/i.test(brief)) {
    return '云端模型余额不足，已改用文档分析估算；可在顶部切换为本地 Ollama 后重试 Agent';
  }
  if (/timeout|超时|5000ms/i.test(brief)) {
    return 'Agent 响应超时，已改用文档分析估算；可增大 AGENT_ESTIMATE_TIMEOUT_MS 或切换本地 Ollama';
  }
  return `Agent 暂不可用（${brief}），已改用文档分析估算`;
}

function applyEstimateBounds(estimated, targetCount) {
  const targets = Math.max(Number(targetCount) || 1, 1);
  return Math.max(targets, Math.min(Math.round(estimated), ESTIMATE_MAX_TOTAL));
}

/** 将合计条数均分到各生成目标（余数从前向后 +1） */
function distributeEstimateEvenly(total, targetCount) {
  const n = Math.max(1, Math.round(Number(targetCount) || 1));
  const safeTotal = Math.max(n, Math.round(Number(total) || 0));
  const base = Math.floor(safeTotal / n);
  let remainder = safeTotal - base * n;
  return Array.from({ length: n }, () => {
    if (remainder > 0) {
      remainder -= 1;
      return base + 1;
    }
    return base;
  });
}

function stripTargetCounts(schemeTargets) {
  return (schemeTargets || []).map(({ count, ...rest }) => ({ ...rest }));
}

function analyzeDocumentHeuristic(content, schemeTargets, categoryMajorIds, validationIds) {
  const text = content || '';
  const len = text.length;
  const sectionCount = (text.match(/^#{1,3}\s+/gm) || []).length;
  const rawApiMethodCount = (text.match(/\b(GET|POST|PUT|PATCH|DELETE)\b/gi) || []).length;
  const rawEndpointCount = (text.match(/\/[a-zA-Z0-9_\-/{:?=.&]+/g) || []).length;
  const uniqueEndpoints = countUniqueMatches(
    text,
    /\/[a-zA-Z0-9_\-/{:?=.&]+/g,
    normalizeEndpointPath,
  );
  const uniqueApiOps = countUniqueMatches(
    text,
    /\b(GET|POST|PUT|PATCH|DELETE)\s+\/[^\s"'`，,;]+/gi,
    s => s.replace(/\s+/g, ' ').trim(),
  );
  const listItemCount = (text.match(/^\s*[-*]\s+/gm) || []).length;
  const tableRowCount = (text.match(/^\|.+\|$/gm) || []).length;
  const codeBlockCount = Math.floor((text.match(/```/g) || []).length / 2);

  const endpointSignal = Math.round(Math.sqrt(Math.max(uniqueEndpoints, 1)) * 2.2 + Math.min(uniqueApiOps, 24) * 0.6);
  const structureSignal = Math.round(sectionCount * 1.2 + Math.sqrt(Math.max(listItemCount, 1)) * 0.5 + tableRowCount * 0.08);
  const lengthSignal = Math.round(Math.sqrt(Math.max(len, 1) / 600));
  const contentBase = Math.max(1, Math.min(
    ESTIMATE_MAX_TOTAL,
    endpointSignal + structureSignal + lengthSignal + codeBlockCount * 0.5,
  ));

  const targetN = schemeTargets.length
    || Math.max(categoryMajorIds.length, 1) * Math.max(validationIds.length, 1);

  let estimated = applyEstimateBounds(contentBase, targetN);
  if (len < 300) {
    estimated = Math.min(estimated, targetN);
  }
  const targetBreakdown = distributeEstimateEvenly(estimated, targetN);

  const parts = [
    `文档约 ${len} 字`,
    sectionCount ? `${sectionCount} 个章节` : null,
    rawApiMethodCount ? `${rawApiMethodCount} 处 HTTP 方法（去重接口 ${uniqueApiOps || uniqueEndpoints} 个）` : null,
    rawEndpointCount ? `${rawEndpointCount} 处路径/接口（去重 ${uniqueEndpoints} 个）` : null,
    listItemCount ? `${listItemCount} 条列表项` : null,
  ].filter(Boolean);

  const targetDesc = schemeTargets.length
    ? `${schemeTargets.length} 个生成目标`
    : `${categoryMajorIds.length} 个大类 × ${validationIds.length || 1} 种验证`;
  const breakdownStr = targetBreakdown.length
    ? `（各目标约 ${targetBreakdown.join('/')} 条）`
    : '';

  return {
    estimated_count: estimated,
    target_breakdown: targetBreakdown,
    reasoning: `${parts.join('、')}；${targetDesc}，建议生成约 ${estimated} 条${breakdownStr}`,
  };
}

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
      task_name,
      options = {},
      fitness_context,
      llm_profile,
    } = payload;

    if (fitness_context && typeof fitness_context === 'object') {
      options.fitness_context = { ...(options.fitness_context || {}), ...fitness_context };
    }

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
      status: 'waiting',
      current_phase: 'analyze',
      progress: { overall_percent: 0, analyze: 0, generate: 0, review: 0 },
      agent_context: {
        current_direction: '已加入队列，等待执行…',
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
      started_at: null,
      created_by: this.ctx.state?.user?.id || null,
    });

    const resolvedTaskName = task_name?.trim() || `任务 #${job.id}`;
    await this.ctx.service.generationTask.register(job.id, resolvedTaskName);

    await this.ctx.service.generationQueue.enqueue({
      jobId: job.id,
      taskName: resolvedTaskName,
      payload: jobPayload,
      projectCode: project_code,
      projectName: project_name,
    });

    return { job_id: job.id, id: job.id, status: 'waiting', task_name: resolvedTaskName };
  }

  async estimateCaseCount(payload = {}) {
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

    let resolvedContent = document_content || null;
    let resolvedTitle = document_title || null;
    let contentWarning = null;

    if (staging_id) {
      try {
        const staged = await this.ctx.service.documentStaging.resolveFullContent(staging_id);
        resolvedContent = staged.content;
        resolvedTitle = staged.title;
      } catch (err) {
        contentWarning = err.message || '文档暂不可用';
        this.ctx.app.logger.warn('[generationJob] estimate staging failed: %s', contentWarning);
      }
    } else if (!resolvedContent && document_id) {
      try {
        const doc = await this.ctx.service.document.findById(document_id);
        if (doc) {
          resolvedContent = doc.content;
          resolvedTitle = doc.title;
        }
      } catch (err) {
        contentWarning = err.message || '文档读取失败';
      }
    }

    const category_major_ids = options.category_major_ids || [];
    const validation_ids = options.validation_ids || [];
    let scheme_targets = options.scheme_targets?.length
      ? stripTargetCounts(options.scheme_targets)
      : await buildSchemeTargetsFromMajors(this.app, {
        category_major_ids,
        validation_ids,
        major_counts: {},
        default_count: 1,
      });

    if (!resolvedContent) {
      const fallbackTotal = Math.max(scheme_targets.length || 1, 1);
      return {
        estimated_count: fallbackTotal,
        target_breakdown: distributeEstimateEvenly(fallbackTotal, scheme_targets.length || 1),
        source: 'configured',
        reasoning: contentWarning
          ? `${contentWarning}，无法读取文档，按 ${scheme_targets.length || 1} 个生成目标各 1 条估算`
          : `未提供文档内容，按 ${scheme_targets.length || 1} 个生成目标各 1 条估算`,
        scheme_target_count: scheme_targets.length,
      };
    }

    const heuristic = analyzeDocumentHeuristic(
      resolvedContent,
      scheme_targets,
      category_major_ids,
      validation_ids,
    );
    let estimatedCount = heuristic.estimated_count;
    let targetBreakdown = heuristic.target_breakdown || [];
    let source = 'heuristic';
    let reasoning = heuristic.reasoning;
    let agentWarning = null;

    const estimateTimeoutMs = Number(this.config.agentPlatform?.estimateTimeoutMs) || DEFAULT_ESTIMATE_TIMEOUT_MS;

    const tryAgentEstimate = async (profileId) => this.ctx.service.agentProxy.invokeTestgen({
      action: 'estimate_case_count',
      document_content: resolvedContent,
      document_title: resolvedTitle || '文档',
      document_type: document_type || 'markdown',
      project_code,
      project_name,
      options: {
        category_major_ids,
        validation_ids,
        scheme_targets,
        hint: options.hint,
      },
      llm_profile: profileId,
      trace: { action: 'estimate' },
    }, estimateTimeoutMs);

    try {
      const agentRes = await tryAgentEstimate(llm_profile);
      const output = agentRes.output || agentRes;
      const agentEstimate = Number(output.estimated_count ?? output.estimate ?? output.count);
      if (Number.isFinite(agentEstimate) && agentEstimate > 0) {
        estimatedCount = applyEstimateBounds(agentEstimate, scheme_targets.length || 1);
        targetBreakdown = Array.isArray(output.target_breakdown) && output.target_breakdown.length
          ? output.target_breakdown.map(n => Math.max(1, Math.round(Number(n) || 1)))
          : distributeEstimateEvenly(estimatedCount, scheme_targets.length || 1);
        source = output.source || 'agent';
        reasoning = output.reasoning || output.summary || reasoning;
      }
    } catch (err) {
      this.ctx.app.logger.warn('[generationJob] estimate agent failed: %s', err.message);
      agentWarning = formatAgentEstimateWarning(err);

      if (isLlmUnavailableError(err) && !isLocalOllamaProfile(llm_profile)) {
        try {
          const agentRes = await tryAgentEstimate('ollama-qwen');
          const output = agentRes.output || agentRes;
          const agentEstimate = Number(output.estimated_count ?? output.estimate ?? output.count);
          if (Number.isFinite(agentEstimate) && agentEstimate > 0) {
            estimatedCount = applyEstimateBounds(agentEstimate, scheme_targets.length || 1);
            targetBreakdown = Array.isArray(output.target_breakdown) && output.target_breakdown.length
              ? output.target_breakdown.map(n => Math.max(1, Math.round(Number(n) || 1)))
              : distributeEstimateEvenly(estimatedCount, scheme_targets.length || 1);
            source = output.source || 'agent';
            agentWarning = null;
            reasoning = output.reasoning || output.summary || reasoning;
          }
        } catch (retryErr) {
          this.ctx.app.logger.warn('[generationJob] estimate ollama fallback failed: %s', retryErr.message);
        }
      }
    }

    const scheme_targets_with_counts = scheme_targets.map((t, i) => ({
      ...t,
      count: targetBreakdown[i] ?? distributeEstimateEvenly(estimatedCount, scheme_targets.length)[i],
    }));

    return {
      estimated_count: estimatedCount,
      target_breakdown: targetBreakdown,
      scheme_targets: scheme_targets_with_counts,
      source,
      reasoning,
      agent_warning: agentWarning,
      scheme_target_count: scheme_targets.length,
    };
  }

  async loadExistingCaseContext(jobId, schemeId, validationId) {
    const { QueryTypes } = require('sequelize');
    const rows = await this.app.model.query(
      `SELECT item_name, detail_summary, expected_observation
       FROM test_item_detail
       WHERE generation_job_id = :jobId
         AND scheme_primary_id = :schemeId
         AND validation_primary_id = :validationId`,
      {
        replacements: { jobId, schemeId, validationId },
        type: QueryTypes.SELECT,
      },
    );
    const seenKeys = new Set();
    for (const row of rows) {
      const key = caseDedupeKey(row);
      if (key) seenKeys.add(key);
    }
    return {
      produced: rows.length,
      writtenSummaries: summarizeExistingCases(rows),
      seenKeys,
    };
  }

  async syncTargetStatesFromDb(jobId, targetStates = []) {
    const { QueryTypes } = require('sequelize');
    const counts = await this.app.model.query(
      `SELECT scheme_primary_id, validation_primary_id, COUNT(*)::int AS cnt
       FROM test_item_detail
       WHERE generation_job_id = :jobId
       GROUP BY scheme_primary_id, validation_primary_id`,
      { replacements: { jobId }, type: QueryTypes.SELECT },
    );
    const map = new Map(
      counts.map(c => [
        `${c.scheme_primary_id}::${c.validation_primary_id}`,
        Number(c.cnt) || 0,
      ]),
    );
    return targetStates.map(t => ({
      ...t,
      produced: map.get(`${t.scheme_id}::${t.validation_id}`) ?? (Number(t.produced) || 0),
    }));
  }

  /** 取消/失败时从 DB 同步已入库条数，保留已通过审查的数据 */
  async finalizeJobProgress(jobId, { status, errorMessage } = {}) {
    const row = await this.ctx.model.GenerationJob.findByPk(jobId);
    if (!row) return null;

    const scheme_targets = row.options?.scheme_targets || row.agent_context?.scheme_targets || [];
    const baseStates = row.agent_context?.target_states?.length
      ? row.agent_context.target_states
      : scheme_targets.map(t => ({ ...t, status: 'pending', produced: 0 }));
    const targetStates = await this.syncTargetStatesFromDb(jobId, baseStates);
    const totalProduced = targetStates.reduce((s, t) => s + (Number(t.produced) || 0), 0);
    const totalConfigured = scheme_targets.reduce((s, t) => s + (Number(t.count) || 0), 0);
    const overallPercent = totalConfigured
      ? Math.min(100, Math.round((totalProduced / totalConfigured) * 100))
      : 0;

    let finalStatus = status || row.status;
    if (status === 'failed' && totalProduced > 0) {
      finalStatus = 'partial';
    }

    let interruptNotice = null;
    if (status === 'cancelled' && totalProduced > 0) {
      interruptNotice = `任务已取消，已通过审查的 ${totalProduced} 条用例已保留入库`;
    } else if (status === 'failed' && totalProduced > 0) {
      interruptNotice = `任务异常结束，已通过审查的 ${totalProduced} 条用例已保留入库`;
    }

    await row.update({
      status: finalStatus,
      error_message: errorMessage !== undefined ? errorMessage : row.error_message,
      agent_context: {
        ...(row.agent_context || {}),
        target_states: targetStates,
        scheme_targets,
        total_produced: totalProduced,
        total_configured: totalConfigured,
        overall_percent: overallPercent,
        interrupt_notice: interruptNotice,
        updated_at: new Date().toISOString(),
      },
      finished_at: row.finished_at || new Date(),
    });
    return row;
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
    if (!job || job.status === 'cancelled' || job.status === 'paused') return;

    const effectiveLlmProfile = llm_profile || job.agent_context?.llm_profile_id || null;

    const scheme_targets = options.scheme_targets || job.options?.scheme_targets || [];
    const targetStates = scheme_targets.map(t => ({ ...t, status: 'pending', produced: 0 }));
    const allSteps = [];
    const { QueryTypes } = require('sequelize');
    const [ countRow ] = await this.app.model.query(
      `SELECT COUNT(*)::int AS cnt FROM test_item_detail WHERE generation_job_id = :jobId`,
      { replacements: { jobId }, type: QueryTypes.SELECT },
    );
    let totalItems = Number(countRow?.cnt) || 0;
    let lastFailureReason = null;

    try {
      const doc = await this.ctx.service.document.findById(document_id);
      if (!doc) throw new Error('document not found');

      const rawContent = document_content || doc.content;

      for (let ti = 0; ti < scheme_targets.length; ti++) {
        await job.reload();
        if (job.status === 'cancelled' || job.status === 'paused') return;

        const target = scheme_targets[ti];
        targetStates[ti].status = 'running';

        const roundSize = roundRequestSize(effectiveLlmProfile);
        const existing = await this.loadExistingCaseContext(jobId, target.scheme_id, target.validation_id);
        const seenKeys = existing.seenKeys;
        let produced = existing.produced;
        let writtenSummaries = [ ...existing.writtenSummaries ];
        targetStates[ti].produced = produced;
        targetStates[ti].round_request_size = roundSize;
        let roundAttempts = 0;

        while (produced < target.count) {
          roundAttempts += 1;
          await job.reload();
          if (job.status === 'cancelled' || job.status === 'paused') return;

          const requestCount = roundSize;
          const remaining = target.count - produced;
          targetStates[ti].round_attempts = roundAttempts;
          targetStates[ti].current_batch_size = requestCount;

          const batchTarget = {
            ...target,
            count: requestCount,
            round_attempts: roundAttempts,
            round_request_size: requestCount,
            target_produced: produced,
            target_total: target.count,
          };

          const targetLabel = `${target.scheme_name || target.scheme_id} · ${target.validation_name || target.validation_id}`;
          const existingCasesContext = buildExistingCasesContextText(writtenSummaries, requestCount);

          await this.updateSchemeProgress(jobId, {
            targetIndex: ti,
            phaseIndex: 1,
            target: batchTarget,
            targetStates,
            scheme_targets,
            direction: `${targetLabel} · 第 ${roundAttempts} 轮（固定请求 ${requestCount} 条，还需入库 ${remaining} 条，已入库 ${produced}/${target.count}）`,
          });

          let agentRes;
          try {
            agentRes = await this.ctx.service.agentProxy.invokeTestgen({
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
              existing_cases_context: existingCasesContext,
              options: {
                ...options,
                hint: options.hint,
                category_major_id: target.category_major_id,
                type_counts: {
                  '功能测试': requestCount,
                  '边界值测试': requestCount,
                },
                scheme_target: batchTarget,
                round_attempts: roundAttempts,
                round_request_size: requestCount,
                batch_size: requestCount,
                regenerate_count: requestCount,
                target_total: target.count,
                target_produced: produced,
                existing_cases: writtenSummaries,
                existing_cases_context: existingCasesContext,
              },
              fitness_context: {
                ...(options.fitness_context || {}),
                scheme_id: target.scheme_id,
                validation_id: target.validation_id,
                category_major_id: target.category_major_id,
                template_code: target.template_code,
              },
              fitness_primary_context: buildFitnessPrimaryContextText(batchTarget, {
                existingCases: writtenSummaries,
                regenerateCount: requestCount,
              }),
              template_output_format: buildTemplateOutputFormatText(target.template_code),
              scheme_id: target.scheme_id,
              validation_id: target.validation_id,
              template_code: target.template_code,
              job_id: jobId,
              llm_profile: effectiveLlmProfile,
              trace: { job_id: jobId },
            });
          } catch (invokeErr) {
            const brief = String(invokeErr.message || 'Agent 调用失败').split('\n')[0].slice(0, 200);
            lastFailureReason = brief;
            this.ctx.app.logger.warn(
              '[generationJob] job=%s target=%s round=%s invoke failed: %s',
              jobId, target.scheme_id, roundAttempts, invokeErr.message,
            );
            const willRetry = produced < target.count;
            const retryNotice = `第 ${roundAttempts} 轮：${brief}${willRetry ? '，正在重试…' : ''}`;
            allSteps.push({
              bff_milestone: true,
              phase: 'retry',
              note: `${targetLabel} · ${retryNotice}（已入库 ${produced}/${target.count}）`,
              scheme_id: target.scheme_id,
              validation_id: target.validation_id,
              round_attempts: roundAttempts,
              attempt: roundAttempts,
            });
            await this.updateSchemeProgress(jobId, {
              targetIndex: ti,
              phaseIndex: PHASES.length - 1,
              target: batchTarget,
              targetStates,
              scheme_targets,
              direction: `${targetLabel} · ${retryNotice}`,
              steps_log: allSteps,
              retry_notice: retryNotice,
            });
            if (!willRetry) break;
            continue;
          }

          const rawCases = this.collectTestCasesFromOutput(agentRes.output || {});
          const { approved, rejected } = reviewCasesIndividually(rawCases);

          if (rejected.length) {
            this.ctx.app.logger.warn(
              '[generationJob] job=%s target=%s round=%s review rejected=%j',
              jobId, target.scheme_id, roundAttempts,
              rejected.map(r => ({ name: r.item_name, errors: r.errors })),
            );
          }
          if (rawCases.length && !approved.length) {
            const sample = rejected[0] || {};
            lastFailureReason = sample.errors?.length
              ? `字段校验未通过：${sample.errors.join('；')}`
              : 'Agent 返回用例但未通过字段校验';
          }

          const picked = pickUniqueApprovedCases(approved, seenKeys, requestCount, false);
          const toInsert = picked.slice(0, remaining);
          registerCaseKeys(toInsert, seenKeys);
          const truncated = picked.length - toInsert.length;
          let retryNotice = null;
          let direction = '';

          if (toInsert.length > 0) {
            const itemIds = await this.ctx.service.generationItemWriter.bulkInsertItems(
              toInsert,
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
                id_offset: produced,
              },
            );

            produced += itemIds.length;
            totalItems += itemIds.length;
            targetStates[ti].produced = produced;
            writtenSummaries.push(...summarizeExistingCases(toInsert));

            const rejectPart = rejected.length ? `，字段未通过 ${rejected.length} 条` : '';
            const truncatePart = truncated > 0 ? `，余 ${truncated} 条已通过但未入库（目标已满）` : '';
            const milestoneNote = `${targetLabel} · 第 ${roundAttempts} 轮：请求 ${requestCount} 条，审查入库 ${itemIds.length} 条${rejectPart}${truncatePart}（累计 ${produced}/${target.count}）`;
            direction = milestoneNote;
            allSteps.push({
              bff_milestone: true,
              phase: 'persist',
              note: milestoneNote,
              scheme_id: target.scheme_id,
              validation_id: target.validation_id,
              round_attempts: roundAttempts,
              attempt: roundAttempts,
              review_approved: itemIds.length,
              review_rejected: rejected.length,
              persisted_count: itemIds.length,
              total_produced: produced,
              target_total: target.count,
            });

            targetStates[ti].last_batch_approved = itemIds.length;
            targetStates[ti].last_review_rejected = rejected.length;
            targetStates[ti].last_attempt_empty = false;
          } else {
            targetStates[ti].last_attempt_empty = true;
            targetStates[ti].last_batch_approved = 0;
            targetStates[ti].last_review_rejected = rejected.length;
            const rejectPart = rejected.length ? `，字段未通过 ${rejected.length} 条` : '';
            const willRetry = produced < target.count;
            retryNotice = `第 ${roundAttempts} 轮：无新增可入库用例${rejectPart}${willRetry ? '，继续补生成…' : ''}`;
            direction = `${targetLabel} · ${retryNotice}（已入库 ${produced}/${target.count}）`;
            allSteps.push({
              bff_milestone: true,
              phase: 'retry',
              note: direction,
              scheme_id: target.scheme_id,
              validation_id: target.validation_id,
              round_attempts: roundAttempts,
              attempt: roundAttempts,
              review_approved: 0,
              review_rejected: rejected.length,
              total_produced: produced,
              target_total: target.count,
            });
          }

          targetStates[ti].round_attempts = roundAttempts;
          targetStates[ti].attempt = roundAttempts;
          targetStates[ti].last_review_passed = produced;

          await this.updateSchemeProgress(jobId, {
            targetIndex: ti,
            phaseIndex: PHASES.length - 1,
            target: batchTarget,
            targetStates,
            scheme_targets,
            direction,
            steps_log: allSteps,
            retry_notice: retryNotice,
          });

          if (produced >= target.count) break;
        }

        if (produced === 0) {
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
            retry_notice: `${target.scheme_name || target.scheme_id} · ${target.validation_name || target.validation_id} 分批生成后仍无有效用例`,
          });
          continue;
        }

        targetStates[ti].status = produced >= target.count ? 'done' : 'partial';
        if (produced < target.count) {
          await this.updateSchemeProgress(jobId, {
            targetIndex: ti,
            phaseIndex: PHASES.length,
            target,
            targetStates,
            scheme_targets,
            direction: `${target.scheme_name || target.scheme_id} 部分完成，写入 ${produced}/${target.count} 条`,
            steps_log: allSteps,
            retry_notice: `${target.scheme_name || target.scheme_id} · ${target.validation_name || target.validation_id} 未达目标条数，已写入 ${produced}/${target.count} 条`,
          });
        } else {
          await this.updateSchemeProgress(jobId, {
            targetIndex: ti,
            phaseIndex: PHASES.length,
            target,
            targetStates,
            scheme_targets,
            direction: `${target.scheme_name || target.scheme_id} 已完成，写入 ${produced} 条`,
            steps_log: allSteps,
            retry_notice: null,
          });
        }
      }

      if (totalItems === 0) {
        const llmOrAgent = lastFailureReason && /LLM|ECONNREFUSED|fetch failed|Authentication|socket hang|Agent|api key|超时|timeout/i.test(lastFailureReason);
        const msg = llmOrAgent
          ? `生成失败：${lastFailureReason}。请确认 Agent（:4001）与所选 LLM 服务可用后重试。`
          : lastFailureReason
            ? `全部生成目标均未产出有效用例。最近原因：${lastFailureReason}`
            : '全部生成目标均未产出通过字段校验的有效用例，请检查文档内容或调整生成配置后重试';
        throw new Error(msg);
      }

      const hasIncomplete = targetStates.some(t => t.status === 'partial' || t.status === 'failed');
      const finalStatus = hasIncomplete ? 'partial' : 'done';
      const finalDirection = hasIncomplete
        ? `部分完成，共写入 ${totalItems} 条（部分方案/验证未达目标）`
        : `全部完成，共写入 ${totalItems} 条测试项`;

      const fitnessPost = await this.runFitnessPostProcess(jobId, {
        project_code,
        options,
      });

      const totalConfigured = scheme_targets.reduce((s, t) => s + (Number(t.count) || 0), 0);
      const finalPercent = totalConfigured
        ? Math.min(100, Math.round((totalItems / totalConfigured) * 100))
        : (totalItems > 0 ? 100 : 0);

      await job.update({
        status: finalStatus,
        current_phase: 'review',
        progress: { overall_percent: finalPercent, analyze: 100, generate: 100, review: 100 },
        steps_log: allSteps,
        agent_context: {
          ...(job.agent_context || {}),
          target_states: targetStates,
          overall_percent: finalPercent,
          total_produced: totalItems,
          total_configured: totalConfigured,
          retry_notice: null,
          fitness_post_process: fitnessPost,
          current_direction: finalDirection,
          updated_at: new Date().toISOString(),
        },
        finished_at: new Date(),
      });
    } catch (err) {
      await job.reload();
      if (job.status !== 'cancelled') {
        await this.finalizeJobProgress(jobId, {
          status: 'failed',
          errorMessage: err.message,
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
    const totalConfigured = scheme_targets.reduce((s, t) => s + (Number(t.count) || 0), 0);
    const totalProduced = targetStates.reduce((s, t) => s + (Number(t.produced) || 0), 0);
    const overallPercent = totalConfigured
      ? Math.min(100, Math.round((totalProduced / totalConfigured) * 100))
      : 0;
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
        total_produced: totalProduced,
        total_configured: totalConfigured,
        current_phase: phase,
        current_direction: direction,
        retry_notice: retry_notice !== undefined ? retry_notice : (row.agent_context?.retry_notice ?? null),
        updated_at: new Date().toISOString(),
      },
    };
    if (steps_log) updates.steps_log = steps_log;
    await row.update(updates);

    try {
      await this.ctx.service.generationQueue.syncProgress(jobId, {
        progressPercent: overallPercent,
        currentPhase: phase,
      });
    } catch (syncErr) {
      this.ctx.app.logger.warn('[generationJob] queue sync job=%s %s', jobId, syncErr.message);
    }
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
      status: 'waiting',
      error_message: null,
      current_phase: 'analyze',
      progress: { overall_percent: 0, analyze: 0, generate: 0, review: 0 },
      agent_context: {
        ...(row.agent_context || {}),
        current_direction: '任务已重新提交，排队等待执行…',
        scheme_targets: row.options?.scheme_targets || [],
        overall_percent: 0,
        updated_at: new Date().toISOString(),
      },
      finished_at: null,
    });

    const registry = await this.ctx.model.GenerationTaskRegistry.findOne({
      where: { job_id: id },
    }).catch(() => null);
    const taskName = registry?.task_name || `任务 #${id}`;

    await this.ctx.service.generationQueue.reenqueueFailed(id, payload, taskName);

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

  async runFitnessPostProcess(jobId, { project_code, options = {} } = {}) {
    const fitnessCtx = options.fitness_context || {};
    const result = { enrich: null, dry_run: null, auto_sample: null };

    const shouldEnrich = fitnessCtx.enrich_samples || fitnessCtx.auto_sample;
    if (shouldEnrich) {
      try {
        const { list } = await this.listGeneratedItems(jobId, { page: 1, pageSize: 50 });
        const agentRes = await this.ctx.service.agentProxy.invokeTestgen({
          action: 'enrich_samples',
          job_id: jobId,
          project_code,
          items: list.map(row => ({
            item_id: row.item_id,
            item_name: row.item_name,
            test_input_example: row.detail_summary,
          })),
          trace: { job_id: jobId },
        });
        result.enrich = agentRes.output || agentRes;
        result.auto_sample = result.enrich;
      } catch (err) {
        this.ctx.app.logger.warn('[generationJob] enrich_samples job=%s %s', jobId, err.message);
        result.enrich = { error: err.message };
      }
    }

    if (fitnessCtx.dry_run) {
      try {
        const { list } = await this.listGeneratedItems(jobId, { page: 1, pageSize: 1 });
        if (list.length) {
          const item = list[0];
          const [ envRows ] = await this.app.model.query(
            'SELECT id FROM ft_execution_env ORDER BY id ASC LIMIT 1',
          );
          const envId = envRows[0]?.id;
          const run = await this.ctx.service.fitnessExecution.orchestrator().launch(item.item_id, {
            env_id: envId,
            scheme_id: item.scheme_primary_id || 'TS-01-DET',
            validation_id: item.validation_primary_id || 'VS-02-CONTRACT',
            dry_run: true,
          });
          result.dry_run = {
            run_id: run?.id,
            item_id: item.item_id,
            status: run?.status,
          };
        } else {
          result.dry_run = { skipped: true, reason: 'no generated items' };
        }
      } catch (err) {
        this.ctx.app.logger.warn('[generationJob] dry_run job=%s %s', jobId, err.message);
        result.dry_run = { error: err.message };
      }
    }

    return result;
  }

  async importSamples(jobId, body = {}) {
    const job = await this.ctx.model.GenerationJob.findByPk(jobId);
    if (!job) return null;

    const sampleSetId = body.sample_set_id;
    if (!sampleSetId) {
      const err = new Error('sample_set_id 为必填');
      err.status = 400;
      throw err;
    }

    const { list } = await this.listGeneratedItems(jobId, { page: 1, pageSize: 500 });
    if (!list.length) {
      const err = new Error('该任务未生成可导入的测试项');
      err.status = 400;
      throw err;
    }

    const items = list.map((row, i) => ({
      sort_order: i,
      input_data: {
        runner: 'http',
        path: '/',
        method: 'GET',
        expect_status: 200,
        source_item_id: row.item_id,
      },
      metadata: { source: 'generation_job', job_id: Number(jobId), item_id: row.item_id },
    }));

    return this.ctx.service.internalFitness.bulkCreateSampleItems({
      sample_set_id: sampleSetId,
      items,
    });
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
    return this.ctx.service.generationQueue.cancel(Number(id));
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
