'use strict';

const Service = require('egg').Service;

class RuntimeService extends Service {
  async ensureDefault() {
    const { baseUrl, expectedVersion } = this.config.comfyui;
    const row = await this.ctx.model.Runtime.findOne({ order: [[ 'id', 'ASC' ]] });
    if (!row) {
      await this.ctx.model.Runtime.create({
        name: '本机源码版',
        base_url: baseUrl,
        expected_version: expectedVersion,
      });
      return;
    }
    if (row.base_url !== baseUrl || row.expected_version !== expectedVersion) {
      await row.update({ base_url: baseUrl, expected_version: expectedVersion });
    }
  }

  async list() {
    return this.ctx.model.Runtime.findAll({ order: [[ 'id', 'ASC' ]] });
  }

  async probe(id) {
    const row = await this.ctx.model.Runtime.findByPk(id);
    if (!row) this.ctx.throw(404, '运行时不存在');
    const snapshot = await this.ctx.service.probe.inspect(row.base_url, row.expected_version);
    const { node_names: nodeNames, models, ...rest } = snapshot;
    return {
      runtime: row,
      ...rest,
      sample_nodes: (nodeNames || []).slice(0, 12),
      checkpoint_names: (models || []).filter(item => item.folder === 'checkpoints').map(item => item.name).slice(0, 30),
      has_wan_video_loader: (nodeNames || []).includes('WanVideoModelLoader'),
      has_checkpoint_loader: (nodeNames || []).includes('CheckpointLoaderSimple'),
    };
  }
}

module.exports = RuntimeService;
