'use strict';

const RunOrchestrator = require('./execution/runOrchestrator');

class FitnessExecutionService extends require('egg').Service {
  orchestrator() {
    return new RunOrchestrator(this.ctx);
  }

  async listEnvs(query = {}) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    const { count, rows } = await this.ctx.model.FtExecutionEnv.findAndCountAll({
      order: [[ 'id', 'ASC' ]],
      limit: pageSize,
      offset,
    });
    return { list: rows, total: count, page, pageSize };
  }

  async createEnv(body) {
    return this.ctx.model.FtExecutionEnv.create(body);
  }

  async updateEnv(id, body) {
    const row = await this.ctx.model.FtExecutionEnv.findByPk(id);
    if (!row) return null;
    await row.update(body);
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
    const run = await this.ctx.model.FtRun.findByPk(id);
    if (!run) return null;
    const results = await this.ctx.model.FtRunResult.findAll({
      where: { ft_run_id: id },
      order: [[ 'sub_index', 'ASC' ]],
    });
    return { ...run.toJSON(), results };
  }

  async saveRunConfig(itemId, body) {
    const [ config ] = await this.ctx.model.FtRunConfig.findOrCreate({
      where: { item_id: itemId, scheme_id: body.scheme_id },
      defaults: { config_json: {}, threshold_json: {} },
    });
    await config.update({
      config_json: body.config_json || {},
      threshold_json: body.threshold_json || {},
      env_id: body.env_id,
      sample_set_id: body.sample_set_id,
    });
    return config;
  }

  async getRunConfig(itemId, schemeId) {
    return this.ctx.model.FtRunConfig.findOne({
      where: { item_id: itemId, scheme_id: schemeId },
    });
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

  async explainRun(runId) {
    const runData = await this.getRun(runId);
    if (!runData) return null;

    const item = await this.orchestrator().loadItem(runData.item_id);
    const observations = (runData.results || []).map(r => ({
      sub_run_index: r.sub_index,
      input_summary: r.input_summary,
      output_summary: r.output_summary,
      sub_verdict: r.sub_verdict,
      assertion_detail: r.assertion_detail,
    }));

    const agentRes = await this.ctx.service.agentProxy.invokeFitnessJudge({
      action: 'explain',
      run_id: runId,
      item_id: runData.item_id,
      observations,
      trace: { run_id: runId, item_id: runData.item_id },
    });

    return {
      run_id: runId,
      markdown: agentRes.output?.markdown || agentRes.reply || '',
      meta: agentRes.meta || {},
    };
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
}

module.exports = FitnessExecutionService;
