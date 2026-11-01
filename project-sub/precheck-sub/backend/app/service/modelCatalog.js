'use strict';

const Service = require('egg').Service;
const { allowedFolder, modelTree } = require('../lib/modelTree');

async function readJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const error = new Error(`${url} -> ${response.status}`);
    error.status = 502;
    throw error;
  }
  return response.json();
}

class ModelCatalogService extends Service {
  async list(folder) {
    if (!allowedFolder(folder)) this.ctx.throw(400, '不支持的模型目录');
    const runtime = await this.ctx.model.Runtime.findOne({ order: [[ 'id', 'ASC' ]] });
    if (!runtime) this.ctx.throw(404, '没有登记运行时');
    const base = String(runtime.base_url || '').replace(/\/$/, '');
    try {
      const list = await readJson(`${base}/models/${encodeURIComponent(folder)}`);
      const names = Array.isArray(list) ? list.map(item => String(item)) : [];
      return {
        folder,
        online: true,
        names,
        tree: modelTree(names),
      };
    } catch (err) {
      return {
        folder,
        online: false,
        names: [],
        tree: [],
        error: err.message || '无法连接 ComfyUI',
      };
    }
  }
}

module.exports = ModelCatalogService;
