'use strict';

const Service = require('egg').Service;
const { formatDateTime } = require('../lib/formatDateTime');
const { invokeSkill, newTraceId } = require('../lib/agentProxy');
const {
  QA_MODULES,
  MODULE_KEYS,
  buildPipelineReport,
  runModuleChecks,
  checkChapterAgainstSetting,
  scoreFromFindings,
  moduleStatuses,
} = require('../lib/novelQa');

class AiReviewService extends Service {
  async loadBundle(novelId) {
    const novel = await this.ctx.service.novel.findById(novelId);
    if (!novel) return null;
    const row = await this.ctx.model.Novel.findByPk(novelId);
    const setting = row?.setting_json || {};
    const bodies = await this.ctx.model.NovelChapterBody.findAll({
      where: { novel_id: novelId },
      attributes: ['chapter_id', 'body', 'word_count'],
    });
    return { novel, setting, bodies, row };
  }

  readCachedQa(setting = {}) {
    const qa = setting?.qa;
    if (!qa || typeof qa !== 'object') return null;
    return qa;
  }

  async persistQa(novelId, report, ignoredIds = []) {
    // 写入前重读，避免与章级核检并发时覆盖 chapters 缓存
    const row = await this.ctx.model.Novel.findByPk(novelId);
    if (!row) return null;
    const prev = row.setting_json?.qa || {};
    const patch = {
      qa: {
        score: report.score,
        status: report.status,
        summary: report.summary,
        passed: report.passed,
        modules: report.modules,
        findings: report.findings,
        modules_checked: report.modules_checked,
        ignored_ids: ignoredIds,
        source: report.source || 'deterministic',
        chapters: report.chapters || prev.chapters || {},
        updated_at: formatDateTime(new Date()),
      },
    };
    await this.ctx.service.novel.updateSetting(novelId, patch);
    return patch.qa;
  }

  mergeLlmFindings(baseReport, llmFindings = [], ignoredIds = []) {
    const findings = [...(baseReport.findings || [])];
    for (const item of llmFindings) {
      if (!item || !item.message) continue;
      const module = MODULE_KEYS.includes(item.module) ? item.module : 'basic';
      const code = item.code || 'llm_finding';
      const chapter = item.chapter_id != null ? String(item.chapter_id) : '';
      const entity = String(item.entity || '').slice(0, 64);
      const id = item.id || `f_${module}_${code}_${chapter}_${entity}`.replace(/\s+/g, '_');
      if (findings.some((row) => row.id === id || (row.code === code && row.entity === entity && row.module === module))) {
        continue;
      }
      findings.push({
        id,
        module,
        code,
        severity: ['error', 'warning', 'info'].includes(item.severity) ? item.severity : 'warning',
        entity: item.entity || '',
        message: String(item.message).slice(0, 2000),
        evidence: String(item.evidence || '').slice(0, 500),
        suggestion: String(item.suggestion || '').slice(0, 1000),
        chapter_id: item.chapter_id || null,
      });
    }
    const ignored = Array.isArray(ignoredIds) ? ignoredIds : [];
    const stats = scoreFromFindings(findings, ignored);
    return {
      ...baseReport,
      findings,
      modules: moduleStatuses(findings, ignored),
      ...stats,
      passed: stats.status !== 'fail',
      summary: stats.status === 'pass'
        ? '全流程核检通过'
        : `发现 ${stats.error_count} 个错误、${stats.warning_count} 个警告`,
      source: llmFindings.length ? 'deterministic+llm' : baseReport.source,
    };
  }

  async tryInvokeReviewSkill(payload) {
    try {
      const result = await invokeSkill(this.ctx, {
        skill: 'novel-review-skill',
        action: payload.action || 'check_consistency',
        payload: {
          ...payload,
          trace_id: newTraceId(),
        },
        timeoutMs: 180000,
      });
      const data = result?.data || result || {};
      return Array.isArray(data.findings) ? data.findings : (data.patch?.findings || []);
    } catch (err) {
      this.ctx.logger.warn('[aiReview] skill skipped: %s', err.message);
      return null;
    }
  }

  async review({ novelId, action = 'check_consistency', module, chapterId, useLlm = false, persist = true }) {
    const allowed = new Set(['check_consistency', 'validate_module', 'validate_chapter']);
    if (!allowed.has(action)) {
      const err = new Error('无效的核检 action');
      err.status = 400;
      throw err;
    }
    const bundle = await this.loadBundle(novelId);
    if (!bundle) {
      const err = new Error('小说不存在');
      err.status = 404;
      throw err;
    }
    const { novel, setting, bodies } = bundle;
    const ignoredIds = Array.isArray(setting?.qa?.ignored_ids) ? setting.qa.ignored_ids.map(String) : [];
    const ctx = { novel, setting, bodies };

    let report;
    if (action === 'validate_module') {
      const key = MODULE_KEYS.includes(module) ? module : null;
      if (!key) {
        const err = new Error('无效的核检模块');
        err.status = 400;
        throw err;
      }
      const findings = runModuleChecks(key, ctx);
      const stats = scoreFromFindings(findings, ignoredIds);
      report = {
        action,
        modules_checked: [key],
        findings,
        modules: moduleStatuses(findings, ignoredIds),
        ...stats,
        passed: stats.status !== 'fail',
        summary: findings.length ? `「${QA_MODULES.find((m) => m.key === key)?.label}」发现 ${findings.length} 条` : '本模块通过',
        source: 'deterministic',
      };
    } else if (action === 'validate_chapter') {
      if (!chapterId) {
        const err = new Error('chapter_id 必填');
        err.status = 400;
        throw err;
      }
      const chapters = Array.isArray(setting.chapters) ? setting.chapters : [];
      const chapter = chapters.find((ch) => String(ch.id) === String(chapterId));
      if (!chapter) {
        const err = new Error('章节不存在');
        err.status = 404;
        throw err;
      }
      const bodyRow = bodies.find((b) => String(b.chapter_id) === String(chapterId));
      const findings = checkChapterAgainstSetting(novel, setting, chapter, bodyRow?.body || '', bodyRow || {});
      const stats = scoreFromFindings(findings, ignoredIds);
      report = {
        action,
        chapter_id: String(chapterId),
        modules_checked: MODULE_KEYS,
        findings,
        modules: moduleStatuses(findings, ignoredIds),
        ...stats,
        passed: stats.status !== 'fail',
        summary: findings.length ? `本章发现 ${findings.length} 条问题` : '本章核检通过',
        source: 'deterministic',
      };
    } else {
      report = buildPipelineReport(ctx, MODULE_KEYS, ignoredIds);
    }

    if (useLlm) {
      const bodyRow = action === 'validate_chapter'
        ? bodies.find((b) => String(b.chapter_id) === String(chapterId))
        : null;
      const llmFindings = await this.tryInvokeReviewSkill({
        action,
        novel_id: novelId,
        chapter_id: chapterId ? String(chapterId) : null,
        module: module || null,
        bound_context: {
          basic: {
            title: novel.title,
            creative_intent: novel.creative_intent,
            summary: novel.summary,
            genre: novel.genre,
            novel_type: novel.novel_type,
          },
          world: setting.world || {},
          factions: setting.factions || [],
          characters: setting.characters || [],
          character_edges: setting.character_edges || [],
          outline: setting.outline || { volumes: setting.volumes || [] },
          chapters: setting.chapters || [],
          chapter: action === 'validate_chapter'
            ? {
              id: String(chapterId),
              body_excerpt: String(bodyRow?.body || '').slice(0, 6000),
              word_count: Number(bodyRow?.word_count) || 0,
            }
            : null,
        },
        deterministic_findings: report.findings,
      });
      if (Array.isArray(llmFindings)) {
        report = this.mergeLlmFindings(report, llmFindings, ignoredIds);
      }
    }

    report.ignored_ids = ignoredIds;
    report.novel_id = Number(novelId);
    report.updated_at = formatDateTime(new Date());

    if (persist && (action === 'check_consistency' || action === 'validate_module')) {
      // 单模块检验也刷新缓存分数：与全量合并
      if (action === 'validate_module') {
        const full = buildPipelineReport(ctx, MODULE_KEYS, ignoredIds);
        const mergedFindings = [...full.findings];
        for (const f of report.findings) {
          if (!mergedFindings.some((x) => x.id === f.id && x.code === f.code && x.entity === f.entity)) {
            mergedFindings.push(f);
          }
        }
        const stats = scoreFromFindings(mergedFindings, ignoredIds);
        const cached = {
          ...full,
          findings: mergedFindings,
          modules: moduleStatuses(mergedFindings, ignoredIds),
          ...stats,
          passed: stats.status !== 'fail',
          summary: stats.status === 'pass'
            ? '全流程核检通过'
            : `发现 ${stats.error_count} 个错误、${stats.warning_count} 个警告`,
          source: report.source,
          chapters: setting?.qa?.chapters || {},
        };
        await this.persistQa(novelId, cached, ignoredIds);
        report.health = {
          score: cached.score,
          status: cached.status,
          summary: cached.summary,
        };
      } else {
        const saved = await this.persistQa(novelId, {
          ...report,
          chapters: setting?.qa?.chapters || {},
        }, ignoredIds);
        report.health = {
          score: saved.score,
          status: saved.status,
          summary: saved.summary,
        };
      }
    } else if (persist && action === 'validate_chapter') {
      // 写入前重读，合并 chapters，避免覆盖全书 findings
      const row = await this.ctx.model.Novel.findByPk(novelId);
      const prev = row?.setting_json?.qa || {};
      const chaptersMap = { ...(prev.chapters || {}) };
      chaptersMap[String(chapterId)] = {
        chapter_id: String(chapterId),
        score: report.score,
        status: report.status,
        passed: report.passed,
        summary: report.summary,
        findings: report.findings,
        modules: report.modules,
        updated_at: formatDateTime(new Date()),
      };
      const nextQa = {
        score: prev.score ?? report.score,
        status: prev.status || report.status,
        summary: prev.summary || report.summary,
        passed: prev.passed ?? report.passed,
        modules: prev.modules || report.modules,
        findings: prev.findings || [],
        modules_checked: prev.modules_checked || report.modules_checked,
        ignored_ids: Array.isArray(prev.ignored_ids) ? prev.ignored_ids : ignoredIds,
        source: prev.source || report.source,
        chapters: chaptersMap,
        updated_at: formatDateTime(new Date()),
      };
      // 若尚无全书报告，用本章结果暂充健康度，避免列表一直「未核检」
      if (prev.score == null) {
        nextQa.score = report.score;
        nextQa.status = report.status;
        nextQa.summary = report.summary;
        nextQa.passed = report.passed;
        nextQa.modules = report.modules;
        nextQa.findings = report.findings;
        nextQa.modules_checked = report.modules_checked;
      }
      await this.ctx.service.novel.updateSetting(novelId, { qa: nextQa });
      report.health = {
        score: nextQa.score,
        status: nextQa.status,
        summary: nextQa.summary,
      };
      report.chapter_report = chaptersMap[String(chapterId)];
    }

    return report;
  }

  async getReport(novelId) {
    const bundle = await this.loadBundle(novelId);
    if (!bundle) return null;
    const cached = this.readCachedQa(bundle.setting);
    if (cached) {
      return {
        ...cached,
        novel_id: Number(novelId),
        modules_meta: QA_MODULES,
      };
    }
    // 无缓存时即时跑确定性全检并落库
    return this.review({ novelId, action: 'check_consistency', useLlm: false, persist: true });
  }

  async ignoreFinding(novelId, findingId) {
    const bundle = await this.loadBundle(novelId);
    if (!bundle) return null;
    const qa = this.readCachedQa(bundle.setting) || { findings: [], ignored_ids: [] };
    const ignored = new Set(qa.ignored_ids || []);
    ignored.add(String(findingId));
    const ignoredIds = [...ignored];
    const stats = scoreFromFindings(qa.findings || [], ignoredIds);
    const next = {
      ...qa,
      ...stats,
      passed: stats.status !== 'fail',
      modules: moduleStatuses(qa.findings || [], ignoredIds),
      ignored_ids: ignoredIds,
      summary: stats.status === 'pass'
        ? '全流程核检通过'
        : `发现 ${stats.error_count} 个错误、${stats.warning_count} 个警告`,
      updated_at: formatDateTime(new Date()),
    };
    await this.ctx.service.novel.updateSetting(novelId, { qa: next });
    return next;
  }
}

module.exports = AiReviewService;
