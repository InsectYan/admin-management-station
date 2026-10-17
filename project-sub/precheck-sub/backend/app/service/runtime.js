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

  async start(id) {
    const row = await this.ctx.model.Runtime.findByPk(id);
    if (!row) this.ctx.throw(404, '运行时不存在');
    const snapshot = await this.ctx.service.probe.inspect(row.base_url, row.expected_version);
    if (snapshot.online) {
      return {
        already_running: true,
        started: false,
        message: 'ComfyUI 已在运行',
      };
    }
    const launched = await this.launchOnHost();
    return {
      already_running: Boolean(launched.already_running),
      started: !launched.already_running,
      message: launched.message || '已执行启动指令',
    };
  }

  async launchOnHost() {
    const { startBridgeUrl, startToken } = this.config.comfyui;
    let response;
    try {
      response = await fetch(startBridgeUrl, {
        method: 'POST',
        headers: { 'x-start-token': startToken },
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      const error = new Error('无法执行启动指令：本机启动桥没有响应');
      error.status = 503;
      throw error;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      const error = new Error(body.message || '启动指令执行失败');
      error.status = response.status || 502;
      throw error;
    }
    return body;
  }
}

module.exports = RuntimeService;
