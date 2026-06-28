'use strict';

const NOT_IMPLEMENTED = '执行引擎尚未开发，详见 nodes.md';

class FitnessExecutionService extends require('egg').Service {
  notImplemented(feature) {
    const err = new Error(`${NOT_IMPLEMENTED} — ${feature}`);
    err.status = 501;
    err.code = 'ENGINE_NOT_IMPLEMENTED';
    throw err;
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

  async healthCheck() {
    this.notImplemented('环境探活代理');
  }

  async listSampleSets(query = {}) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    const { count, rows } = await this.ctx.model.FtSampleSet.findAndCountAll({
      order: [[ 'id', 'DESC' ]],
      limit: pageSize,
      offset,
    });
    return { list: rows, total: count, page, pageSize };
  }

  async createSampleSet(body) {
    return this.ctx.model.FtSampleSet.create(body);
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
    const config = await this.getRunConfig(itemId, body.scheme_id);
    this.notImplemented(`TS 执行引擎 (${body.scheme_id})`);
  }

  async cancelRun(id) {
    const run = await this.ctx.model.FtRun.findByPk(id);
    if (!run) return null;
    await run.update({ status: 'cancelled', finished_at: new Date() });
    return run;
  }

  async executeSchemeEngine(schemeId) {
    this.notImplemented(`方案引擎 ${schemeId}`);
  }
}

module.exports = FitnessExecutionService;
