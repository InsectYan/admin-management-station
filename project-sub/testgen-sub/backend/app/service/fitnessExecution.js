'use strict';

const { buildSchemePhases } = require('../lib/schemePhaseHelper');
const {
  buildExplainObservationFromResult,
  buildRunExplainContext,
  buildExplainTriadTexts,
} = require('../lib/runExplainBuilder');

/** 解读失败原因：等待 AI 最长 15 分钟 */
const EXPLAIN_TIMEOUT_MS = 15 * 60 * 1000;

const RunOrchestrator = require('./execution/runOrchestrator');
const vsRegistry = require('./execution/vsRegistry');
const { buildK6Script } = require('../lib/k6ScriptBuilder');

function assertionEntries(detail) {
  if (Array.isArray(detail)) return detail;
  if (detail && typeof detail === 'object' && Array.isArray(detail.assertions)) {
    return detail.assertions;
  }
  return [];
}

function dbResultToSubResult(row) {
  const detail = row.assertion_detail;
  const isWrapped = detail && typeof detail === 'object' && !Array.isArray(detail);
  return {
    sub_index: row.sub_index,
    input_summary: row.input_summary,
    output_summary: row.output_summary,
    assertion_detail: isWrapped ? (detail.assertions || []) : (detail || []),
    sub_verdict: row.sub_verdict,
    artifacts: isWrapped ? detail.artifacts : undefined,
  };
}

class FitnessExecutionService extends require('egg').Service {
  orchestrator() {
    return new RunOrchestrator(this.ctx);
  }

  async listEnvs(query = {}) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    const projectCode = query.project_code == null ? '' : String(query.project_code).trim();
    if (!projectCode) {
      const err = new Error('listEnvs 需要 project_code，禁止返回跨项目环境列表');
      err.status = 400;
      err.code = 'PROJECT_CODE_REQUIRED';
      throw err;
    }
    // X-03：项目页已配的环境模板，按需同步到执行表，避免 Launch 空列表
    const { ensureProjectTemplatesSynced } = require('../lib/projectEnvToExecution');
    await ensureProjectTemplatesSynced(this.ctx, projectCode);

    const where = { project_code: projectCode };
    const { count, rows } = await this.ctx.model.FtExecutionEnv.findAndCountAll({
      where,
      order: [[ 'id', 'ASC' ]],
      limit: pageSize,
      offset,
    });
    return { list: rows, total: count, page, pageSize, project_code: projectCode };
  }

  async createEnv(body) {
    const projectCode = body.project_code == null ? '' : String(body.project_code).trim();
    if (!projectCode) {
      const err = new Error('创建执行环境必须指定 project_code');
      err.status = 400;
      err.code = 'PROJECT_CODE_REQUIRED';
      throw err;
    }
    if (body.is_default) {
      await this.ctx.model.FtExecutionEnv.update(
        { is_default: false },
        { where: { project_code: projectCode, is_default: true } },
      );
    }
    return this.ctx.model.FtExecutionEnv.create({
      ...body,
      project_code: projectCode,
    });
  }

  async updateEnv(id, body) {
    const row = await this.ctx.model.FtExecutionEnv.findByPk(id);
    if (!row) return null;
    if (body.is_default) {
      await this.ctx.model.FtExecutionEnv.update(
        { is_default: false },
        { where: { project_code: row.project_code, is_default: true } },
      );
    }
    const patch = { ...body };
    delete patch.project_code;
    await row.update(patch);
    return row;
  }

  async deleteEnv(id) {
    const row = await this.ctx.model.FtExecutionEnv.findByPk(id);
    if (!row) return false;
    await row.destroy();
    return true;
  }

  async healthCheck(body = {}) {
    return this.orchestrator().healthCheck(body);
  }

  async listSampleSets(query = {}) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    const where = {};
    if (query.item_id) where.item_id = query.item_id;
    if (query.set_type) where.set_type = query.set_type;
    if (query.api_template_id) where.api_template_id = Number(query.api_template_id);
    const { count, rows } = await this.ctx.model.FtSampleSet.findAndCountAll({
      where,
      order: [[ 'id', 'DESC' ]],
      limit: pageSize,
      offset,
    });
    return { list: rows, total: count, page, pageSize };
  }

  async createSampleSet(body) {
    const row = await this.ctx.model.FtSampleSet.create(body);
    return row;
  }

  async getSampleSet(id) {
    const set = await this.ctx.model.FtSampleSet.findByPk(id);
    if (!set) return null;
    const items = await this.ctx.model.FtSampleItem.findAll({
      where: { sample_set_id: id },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    return { ...set.toJSON(), items };
  }

  async updateSampleSet(id, body) {
    const row = await this.ctx.model.FtSampleSet.findByPk(id);
    if (!row) return null;
    await row.update(body);
    return row;
  }

  async deleteSampleSet(id) {
    const row = await this.ctx.model.FtSampleSet.findByPk(id);
    if (!row) return false;
    await row.destroy();
    return true;
  }

  async syncSampleCount(sampleSetId) {
    const count = await this.ctx.model.FtSampleItem.count({ where: { sample_set_id: sampleSetId } });
    await this.ctx.model.FtSampleSet.update(
      { sample_count: count },
      { where: { id: sampleSetId } },
    );
    return count;
  }

  async listSampleItems(setId) {
    const set = await this.ctx.model.FtSampleSet.findByPk(setId);
    if (!set) return null;
    const items = await this.ctx.model.FtSampleItem.findAll({
      where: { sample_set_id: setId },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    return { set, items };
  }

  async createSampleItem(setId, body) {
    const set = await this.ctx.model.FtSampleSet.findByPk(setId);
    if (!set) {
      const err = new Error('样本集不存在');
      err.status = 404;
      throw err;
    }
    const row = await this.ctx.model.FtSampleItem.create({
      sample_set_id: setId,
      input_data: body.input_data || {},
      expected_data: body.expected_data,
      metadata: body.metadata || {},
      sort_order: body.sort_order ?? 0,
    });
    await this.syncSampleCount(setId);
    return row;
  }

  async updateSampleItem(setId, itemId, body) {
    const row = await this.ctx.model.FtSampleItem.findOne({
      where: { id: itemId, sample_set_id: setId },
    });
    if (!row) return null;
    await row.update({
      input_data: body.input_data ?? row.input_data,
      expected_data: body.expected_data ?? row.expected_data,
      metadata: body.metadata ?? row.metadata,
      sort_order: body.sort_order ?? row.sort_order,
    });
    return row;
  }

  async deleteSampleItem(setId, itemId) {
    const row = await this.ctx.model.FtSampleItem.findOne({
      where: { id: itemId, sample_set_id: setId },
    });
    if (!row) return false;
    await row.destroy();
    await this.syncSampleCount(setId);
    return true;
  }

  async listRuns(query = {}) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    const where = {};
    if (query.item_id) where.item_id = query.item_id;
    if (query.status) where.status = query.status;
    const { count, rows } = await this.ctx.model.FtRun.findAndCountAll({
      where,
      order: [[ 'created_at', 'DESC' ]],
      limit: pageSize,
      offset,
    });
    return { list: rows, total: count, page, pageSize };
  }

  async getRun(id) {
    let run = await this.ctx.model.FtRun.findByPk(id);
    if (!run) return null;

    const rootRunId = run.parent_run_id || run.id;
    if (run.parent_run_id) {
      run = await this.ctx.model.FtRun.findByPk(rootRunId);
      if (!run) return null;
    }

    const secondaryRun = await this.ctx.model.FtRun.findOne({
      where: { parent_run_id: rootRunId, sequence_index: 1 },
      order: [[ 'id', 'DESC' ]],
    });

    const item = await this.orchestrator().loadItem(run.item_id);
    const scheme_phases = buildSchemePhases(item, run, secondaryRun);

    const [ results, steps, secondaryResults ] = await Promise.all([
      this.ctx.model.FtRunResult.findAll({
        where: { ft_run_id: rootRunId },
        order: [[ 'sub_index', 'ASC' ]],
      }),
      this.ctx.model.FtRunStep.findAll({
        where: { ft_run_id: rootRunId },
        order: [[ 'step_index', 'ASC' ]],
      }),
      secondaryRun
        ? this.ctx.model.FtRunResult.findAll({
          where: { ft_run_id: secondaryRun.id },
          order: [[ 'sub_index', 'ASC' ]],
        })
        : Promise.resolve([]),
    ]);

    return {
      ...run.toJSON(),
      results,
      steps,
      scheme_phases,
      secondary_run: secondaryRun
        ? { ...secondaryRun.toJSON(), results: secondaryResults }
        : null,
    };
  }

  async listRunSteps(runId) {
    const run = await this.ctx.model.FtRun.findByPk(runId);
    if (!run) return null;
    const steps = await this.ctx.model.FtRunStep.findAll({
      where: { ft_run_id: runId },
      order: [[ 'step_index', 'ASC' ]],
    });
    return { run_id: Number(runId), steps: steps.map(s => s.toJSON()) };
  }

  async listRunAgentAudit(runId) {
    const run = await this.ctx.model.FtRun.findByPk(runId);
    if (!run) return null;
    const logs = await this.ctx.service.agentAudit.listForRun(runId);
    return {
      run_id: Number(runId),
      logs: logs.map(l => l.toJSON()),
    };
  }

  async saveRunConfig(itemId, body) {
    const [ config ] = await this.ctx.model.FtRunConfig.findOrCreate({
      where: { item_id: itemId, scheme_id: body.scheme_id },
      defaults: { config_json: {}, threshold_json: {} },
    });
    const configJson = body.config_json || {};
    await config.update({
      config_json: configJson,
      threshold_json: body.threshold_json || {},
      env_id: body.env_id,
      sample_set_id: body.sample_set_id ?? configJson.sample_set_id ?? null,
      api_template_id: body.api_template_id ?? configJson.api_template_id ?? null,
      use_api_template: body.use_api_template ?? Boolean(configJson.use_api_template),
      inject_bindings: body.inject_bindings ?? configJson.inject_bindings ?? {},
    });
    return config;
  }

  async getRunConfig(itemId, schemeId) {
    return this.ctx.model.FtRunConfig.findOne({
      where: { item_id: itemId, scheme_id: schemeId },
    });
  }

  async exportK6Script(itemId, schemeId = 'TS-09-LOAD') {
    const config = await this.getRunConfig(itemId, schemeId);
    const cfg = {
      ...(config?.config_json || {}),
      ...(config?.threshold_json || {}),
    };
    const item = await this.orchestrator().loadItem(itemId);
    const projectCode = item?.project_code;
    let env = null;
    if (config?.env_id) {
      env = await this.ctx.model.FtExecutionEnv.findByPk(config.env_id);
      if (env && projectCode && env.project_code !== projectCode) {
        env = null;
      }
    }
    if (!env && projectCode) {
      env = await this.ctx.model.FtExecutionEnv.findOne({
        where: { project_code: projectCode, is_default: true },
        order: [[ 'id', 'ASC' ]],
      }) || await this.ctx.model.FtExecutionEnv.findOne({
        where: { project_code: projectCode },
        order: [[ 'id', 'ASC' ]],
      });
    }
    const script = buildK6Script(cfg, env?.toJSON?.() || env || {});
    return {
      item_id: itemId,
      scheme_id: schemeId,
      filename: `${itemId.replace(/[^\w-]+/g, '_')}-load.js`,
      script,
    };
  }

  async launchRun(itemId, body) {
    return this.orchestrator().launch(itemId, body);
  }

  async cancelRun(id) {
    const run = await this.ctx.model.FtRun.findByPk(id);
    if (!run) return null;
    if (run.status === 'running') {
      /* E1：标记取消；进行中的 CLI 进程暂不 kill */
    }
    await run.update({ status: 'cancelled', finished_at: new Date() });
    return run;
  }

  async executeSchemeEngine(schemeId, body = {}) {
    return this.orchestrator().executeSchemeDebug(schemeId, body);
  }

  /**
   * 组装 explain 请求体（配置项 + 目标项 + 实际返回）
   * @returns {Promise<object|null>}
   */
  async prepareExplainPayload(runId, options = {}) {
    const runData = await this.getRun(runId);
    if (!runData) return null;

    const results = (runData.results || []).map(r => (r.toJSON ? r.toJSON() : r));
    if (!results.length) {
      const err = new Error('该运行无子项结果，无法解读');
      err.status = 400;
      err.code = 'NO_RUN_RESULTS';
      throw err;
    }

    const item = await this.orchestrator().loadItem(runData.item_id);
    const runConfig = await this.getRunConfig(runData.item_id, runData.scheme_id);
    let env = null;
    if (runData.env_id) {
      env = await this.ctx.model.FtExecutionEnv.findByPk(runData.env_id);
    }
    const runContext = buildRunExplainContext(runData, item, runConfig, results, env);
    const obsCtx = {
      template_code: runContext.template_code,
      scheme_id: runContext.scheme_id,
      config_json: runContext.config_json,
      config_bundle: runContext.config_json,
    };

    const failedRows = results.filter(r => r.sub_verdict === 'fail');
    const focusFailed = options.focus !== 'all';
    const sourceRows = focusFailed && failedRows.length ? failedRows : results;
    const observations = sourceRows.map(r => buildExplainObservationFromResult(r, item, obsCtx));
    const triad = buildExplainTriadTexts(runContext, observations);
    const focus = focusFailed && failedRows.length ? 'failed' : 'all';

    return {
      runData,
      item,
      runContext,
      observations,
      triad,
      focus,
      agentPayload: {
        action: 'explain',
        run_id: Number(runId),
        item_id: runData.item_id,
        llm_profile: options.llm_profile,
        focus,
        observations,
        run_context: runContext,
        config_text: triad.config_text,
        expected_text: triad.expected_text,
        actual_text: triad.actual_text,
        assertion_diff_text: triad.assertion_diff_text,
        trace: { run_id: runId, item_id: runData.item_id },
      },
    };
  }

  async explainRun(runId, options = {}) {
    const prepared = await this.prepareExplainPayload(runId, options);
    if (!prepared) return null;

    const agentRes = await this.ctx.service.agentProxy.invokeFitnessJudge(
      prepared.agentPayload,
      EXPLAIN_TIMEOUT_MS,
    );

    if (agentRes.meta?.fallback) {
      const err = new Error('AI 解读不可用（LLM 未配置或未返回有效结果），请检查 Agent/LLM 后重试');
      err.status = 502;
      err.code = 'EXPLAIN_AI_UNAVAILABLE';
      err.data = { fallback: true, meta: agentRes.meta || {} };
      throw err;
    }

    const markdown = agentRes.output?.markdown || agentRes.reply || '';
    if (!markdown.trim()) {
      const err = new Error('Agent 未返回解读内容，请确认 Agent 与 LLM 配置可用');
      err.status = 502;
      err.code = 'EXPLAIN_EMPTY';
      throw err;
    }

    return {
      run_id: Number(runId),
      markdown,
      focus: prepared.focus,
      observation_count: prepared.observations.length,
      run_context: prepared.runContext,
      triad_preview: {
        config_text: prepared.triad.config_text.slice(0, 500),
        expected_text: prepared.triad.expected_text.slice(0, 500),
        assertion_diff_text: prepared.triad.assertion_diff_text.slice(0, 800),
      },
      meta: { ...(agentRes.meta || {}), fallback: false, timeout_ms: EXPLAIN_TIMEOUT_MS },
    };
  }

  /**
   * SSE：先推送思考/状态，最终 event=done 仅含结果文案
   * @param {string|number} runId
   * @param {object} options
   * @param {(event: string, data: object) => void} emit
   */
  async explainRunStream(runId, options = {}, emit) {
    const prepared = await this.prepareExplainPayload(runId, options);
    if (!prepared) {
      const err = new Error('运行记录不存在');
      err.status = 404;
      throw err;
    }

    emit('status', {
      phase: 'prepare',
      label: '已组装配置项 / 目标项 / 实际返回，正在调用 AI…',
      focus: prepared.focus,
      observation_count: prepared.observations.length,
    });
    emit('thinking', {
      label: '对照材料已就绪',
      assertion_diff_text: prepared.triad.assertion_diff_text,
    });

    await this.ctx.service.agentProxy.invokeFitnessJudgeStream(
      prepared.agentPayload,
      EXPLAIN_TIMEOUT_MS,
      (event, data) => {
        if (event === 'status' || event === 'delta') {
          const thinkText = data?.thinking || data?.label || data?.delta || data?.text || '';
          emit('thinking', {
            phase: data?.phase || event,
            label: thinkText || 'AI 思考中…',
            detail: data,
          });
          return;
        }
        if (event === 'error') {
          emit('error', data);
          return;
        }
        if (event === 'done') {
          const markdown = data?.output?.markdown || data?.reply || '';
          const fallback = !!data?.meta?.fallback;
          if (fallback || !String(markdown).trim()) {
            emit('error', {
              message: fallback
                ? 'AI 解读不可用（LLM 未配置或未返回有效结果）'
                : 'Agent 未返回解读内容',
              code: fallback ? 'EXPLAIN_AI_UNAVAILABLE' : 'EXPLAIN_EMPTY',
            });
            return;
          }
          emit('result', {
            run_id: Number(runId),
            markdown,
            focus: prepared.focus,
            observation_count: prepared.observations.length,
            meta: { ...(data.meta || {}), fallback: false, timeout_ms: EXPLAIN_TIMEOUT_MS },
          });
        }
      },
    );
  }

  async generateSamples(body = {}) {
    const agentRes = await this.ctx.service.agentProxy.invokeFitnessSample({
      action: body.action || 'from_example',
      item_id: body.item_id,
      scheme_id: body.scheme_id,
      sample_set_id: body.sample_set_id,
      test_input_example: body.test_input_example,
      trace: { item_id: body.item_id },
    });

    const samples = agentRes.output?.samples || agentRes.output?.items || [];
    if (body.sample_set_id && samples.length && body.persist !== false) {
      const bulk = await this.ctx.service.internalFitness.bulkCreateSampleItems({
        sample_set_id: body.sample_set_id,
        items: samples,
      });
      return { ...agentRes.output, bulk };
    }

    return agentRes.output || agentRes;
  }

  async enrichCsvSamples(body = {}) {
    const { csv_text, item_id, scheme_id } = body;
    if (!csv_text?.trim()) {
      const err = new Error('csv_text 为必填');
      err.status = 400;
      throw err;
    }
    const agentRes = await this.ctx.service.agentProxy.invokeFitnessSample({
      action: 'enrich_csv',
      item_id,
      scheme_id,
      csv_text,
      trace: { item_id },
    });
    const items = agentRes.output?.items || agentRes.output?.samples || [];
    return { items, meta: agentRes.meta || {}, raw: agentRes.output };
  }

  async rerunFailedRun(runId) {
    const runData = await this.getRun(runId);
    if (!runData) return null;

    const failed = (runData.results || []).filter(r => r.sub_verdict === 'fail');
    if (!failed.length) {
      const err = new Error('无失败子项，无需重跑');
      err.status = 400;
      err.code = 'NO_FAILED_SUB_RESULTS';
      throw err;
    }

    return this.orchestrator().launch(runData.item_id, {
      env_id: runData.env_id,
      scheme_id: runData.scheme_id,
      validation_id: runData.validation_id,
    });
  }

  async exportRunLog(runId) {
    const runData = await this.getRun(runId);
    if (!runData) return null;
    return {
      ...runData,
      exported_at: new Date().toISOString(),
    };
  }

  async importSampleItems(setId, body = {}) {
    const items = body.items;
    if (!Array.isArray(items)) {
      const err = new Error('items 必须为数组');
      err.status = 400;
      throw err;
    }
    return this.ctx.service.internalFitness.bulkCreateSampleItems({
      sample_set_id: setId,
      items,
    });
  }

  async scoreManualRun(runId, body = {}) {
    const run = await this.ctx.model.FtRun.findByPk(runId);
    if (!run) return null;

    const results = await this.ctx.model.FtRunResult.findAll({
      where: { ft_run_id: runId },
      order: [[ 'sub_index', 'ASC' ]],
    });

    const targetRow = results.find(row =>
      assertionEntries(row.assertion_detail).some(d => d.type === 'manual_queue'),
    );
    if (!targetRow) {
      const err = new Error('未找到待评审子项');
      err.status = 404;
      err.code = 'MANUAL_QUEUE_NOT_FOUND';
      throw err;
    }

    const detail = targetRow.assertion_detail;
    const isWrapped = detail && typeof detail === 'object' && !Array.isArray(detail);
    const assertions = assertionEntries(detail).map(a => {
      if (a.type === 'manual_queue') {
        return { ...a, status: 'reviewed' };
      }
      return a;
    });
    assertions.push({
      type: 'human_review',
      score: body.score,
      pass: body.pass,
      comment: body.comment,
      reviewer_id: body.reviewer_id,
      reviewed_at: new Date().toISOString(),
    });

    const newDetail = isWrapped
      ? { ...detail, assertions }
      : assertions;
    const subVerdict = body.pass ? 'pass' : 'fail';
    await targetRow.update({
      assertion_detail: newDetail,
      sub_verdict: subVerdict,
    });

    const updatedResults = await this.ctx.model.FtRunResult.findAll({
      where: { ft_run_id: runId },
      order: [[ 'sub_index', 'ASC' ]],
    });
    const subResults = updatedResults.map(dbResultToSubResult);

    const item = await this.orchestrator().loadItem(run.item_id);
    const runConfig = run.run_config_id
      ? await this.ctx.model.FtRunConfig.findByPk(run.run_config_id)
      : await this.ctx.model.FtRunConfig.findOne({
        where: { item_id: run.item_id, scheme_id: run.scheme_id },
      });

    const vsEngine = vsRegistry.get(run.validation_id, runConfig);
    const verdictResult = await vsEngine.judge(
      subResults,
      runConfig?.threshold_json || {},
      item,
      run.validation_id,
      { item, runConfig, run, ctx: this.ctx },
    );

    const finalStatus = verdictResult.pass ? 'success' : 'failed';
    await run.update({
      status: finalStatus,
      verdict: verdictResult.verdict,
      finished_at: new Date(),
      progress: {
        ...(run.progress || {}),
        phase: 'done',
        percent: 100,
        verdict: verdictResult.verdict,
      },
    });

    return {
      run_id: runId,
      sub_verdict: subVerdict,
      verdict: verdictResult.verdict,
      status: finalStatus,
      verdict_detail: verdictResult,
    };
  }

  async preReviewRun(runId) {
    const runData = await this.getRun(runId);
    if (!runData) return null;

    let materials = {};
    for (const row of runData.results || []) {
      const mq = assertionEntries(row.assertion_detail).find(d => d.type === 'manual_queue');
      if (mq?.materials) {
        materials = mq.materials;
        break;
      }
    }

    const agentRes = await this.ctx.service.agentProxy.invokeFitnessJudge({
      action: 'pre_review',
      run_id: runId,
      item_id: runData.item_id,
      materials,
      trace: { run_id: runId, item_id: runData.item_id },
    });

    return {
      run_id: runId,
      markdown: agentRes.output?.markdown || agentRes.reply || '',
      suggestions: agentRes.output?.suggestions || agentRes.output,
      meta: agentRes.meta || {},
    };
  }

  async analyzeLoadRun(runId) {
    const runData = await this.getRun(runId);
    if (!runData) return null;

    if (runData.scheme_id !== 'TS-09-LOAD') {
      const err = new Error('仅 TS-09-LOAD 运行支持负载分析');
      err.status = 400;
      err.code = 'NOT_LOAD_RUN';
      throw err;
    }

    const perfSamples = [];
    for (const row of runData.results || []) {
      const detail = row.assertion_detail;
      const perf = (detail && typeof detail === 'object' && !Array.isArray(detail))
        ? detail.artifacts?.perf
        : null;
      if (perf) perfSamples.push(perf);
    }

    const agentRes = await this.ctx.service.agentProxy.invokePerfAnalysis({
      action: 'analyze_load_run',
      run_id: runId,
      item_id: runData.item_id,
      perf_samples: perfSamples,
      trace: { run_id: runId, item_id: runData.item_id },
    });

    return {
      run_id: runId,
      markdown: agentRes.output?.markdown || agentRes.reply || '',
      analysis: agentRes.output,
      meta: agentRes.meta || {},
    };
  }
}

module.exports = FitnessExecutionService;
