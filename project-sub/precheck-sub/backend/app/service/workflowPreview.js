'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { parseApiWorkflow } = require('../lib/workflowParse');
const { buildSupplies } = require('../lib/supplyCatalog');
const { listPreviewFields, applyPreviewValues, collectMedia } = require('../lib/workflowPreview');

function previewRoot() {
  return process.env.PREVIEW_DIR || '/data/previews';
}

function safeKey(value) {
  const key = String(value || '').trim();
  if (!/^[\w-]{8,80}$/.test(key)) {
    const error = new Error('预览标识无效');
    error.status = 400;
    throw error;
  }
  return key;
}

function comfyMessage(body, status) {
  const error = body?.error;
  if (!error) return `ComfyUI 返回 ${status}`;
  if (typeof error === 'string') return error;
  const nodeErrors = body?.node_errors ? JSON.stringify(body.node_errors).slice(0, 240) : '';
  return [ error.message || error.type || '', nodeErrors ].filter(Boolean).join(' ') || `ComfyUI 返回 ${status}`;
}

class WorkflowPreviewService extends Service {
  drafts() {
    if (!this.app.previewDrafts) this.app.previewDrafts = new Map();
    return this.app.previewDrafts;
  }

  comfyBase() {
    return this.config.comfyui.baseUrl.replace(/\/$/, '');
  }

  dirFor(scope, key) {
    const root = path.resolve(previewRoot());
    const absolute = path.resolve(root, scope, key);
    const relative = path.relative(root, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      const error = new Error('预览路径无效');
      error.status = 400;
      throw error;
    }
    return absolute;
  }

  async fields(apiJson) {
    parseApiWorkflow(apiJson);
    return listPreviewFields(apiJson);
  }

  async inspect(apiJson) {
    const parsed = parseApiWorkflow(apiJson);
    return this.diffParsed(parsed.required_nodes, parsed.required_models, null);
  }

  async diffParsed(requiredNodes, requiredModels, suggestedVramGb) {
    const runtime = await this.ctx.model.Runtime.findOne({ order: [[ 'id', 'ASC' ]] });
    if (!runtime) this.ctx.throw(404, '没有登记运行时');
    const snapshot = await this.ctx.service.probe.inspect(runtime.base_url, runtime.expected_version);
    const diff = this.ctx.service.probe.diff(snapshot, requiredNodes, requiredModels, suggestedVramGb);
    const supplies = snapshot.online
      ? buildSupplies({
        missingNodes: diff.missing_nodes,
        requiredModels,
        installedModels: snapshot.models || [],
      })
      : { note: '', plugins: [], families: [], loose: [] };
    return {
      runtime_id: runtime.id,
      online: snapshot.online,
      version: snapshot.version,
      version_ok: snapshot.version_ok,
      error: snapshot.error,
      ...diff,
      supplies,
    };
  }

  async start({ workflowId, draftKey, apiJson, values }) {
    const graph = applyPreviewValues(apiJson, values);
    parseApiWorkflow(graph);
    let submitted;
    try {
      const res = await fetch(`${this.comfyBase()}/prompt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: graph, client_id: workflowId ? `precheck-${workflowId}` : `precheck-draft-${draftKey}` }),
        signal: AbortSignal.timeout(30000),
      });
      submitted = await res.json();
      if (!res.ok || !submitted.prompt_id) {
        const error = new Error(comfyMessage(submitted, res.status));
        error.status = 502;
        throw error;
      }
    } catch (err) {
      if (err.status) throw err;
      this.ctx.throw(502, `连不上 ComfyUI：${err.message}`);
    }
    const state = {
      status: 'running',
      prompt_id: submitted.prompt_id,
      error: '',
      media_kind: '',
      file_name: '',
      updated_at: new Date().toISOString(),
    };
    await this.writeState(workflowId, draftKey, state);
    return state;
  }

  async writeState(workflowId, draftKey, state) {
    if (workflowId) {
      const row = await this.ctx.service.workflow.show(workflowId);
      await row.update({ preview_json: state });
      return;
    }
    this.drafts().set(safeKey(draftKey), state);
  }

  async currentState(workflowId, draftKey) {
    if (workflowId) {
      const row = await this.ctx.service.workflow.show(workflowId);
      return row.preview_json || null;
    }
    return this.drafts().get(safeKey(draftKey)) || null;
  }

  async read(workflowId, draftKey) {
    let state = await this.currentState(workflowId, draftKey);
    if (!state) return null;
    if (state.status === 'running' && state.prompt_id) {
      state = await this.settle(workflowId, draftKey, state);
    }
    return state;
  }

  async settle(workflowId, draftKey, state) {
    const base = this.comfyBase();
    let item;
    try {
      const res = await fetch(`${base}/history/${state.prompt_id}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return state;
      const history = await res.json();
      item = history[state.prompt_id];
    } catch (err) {
      this.ctx.logger.warn('[precheck] preview history %s', err.message);
      return state;
    }
    if (!item) return state;
    const latest = await this.currentState(workflowId, draftKey);
    if (!latest || latest.prompt_id !== state.prompt_id) return latest;
    if (item.status?.status_str === 'error') {
      const failed = { ...latest, status: 'failed', error: 'ComfyUI 执行失败', updated_at: new Date().toISOString() };
      await this.writeState(workflowId, draftKey, failed);
      return failed;
    }
    if (!item.status?.completed && item.status?.status_str !== 'success') return latest;
    const files = collectMedia(item.outputs);
    const file = files[files.length - 1];
    if (!file) {
      const failed = { ...latest, status: 'failed', error: 'ComfyUI 没有返回图片或视频', updated_at: new Date().toISOString() };
      await this.writeState(workflowId, draftKey, failed);
      return failed;
    }
    try {
      const saved = await this.saveLatest(workflowId, draftKey, file);
      const again = await this.currentState(workflowId, draftKey);
      if (!again || again.prompt_id !== state.prompt_id) return again;
      const success = {
        ...again,
        status: 'success',
        error: '',
        media_kind: file.media_kind,
        file_name: saved,
        updated_at: new Date().toISOString(),
      };
      await this.writeState(workflowId, draftKey, success);
      return success;
    } catch (err) {
      const failed = { ...latest, status: 'failed', error: err.message, updated_at: new Date().toISOString() };
      await this.writeState(workflowId, draftKey, failed);
      return failed;
    }
  }

  async saveLatest(workflowId, draftKey, file) {
    const filename = path.basename(file.filename || '');
    if (!filename) throw new Error('产物文件名无效');
    const view = new URL('/view', `${this.comfyBase()}/`);
    view.searchParams.set('filename', file.filename);
    view.searchParams.set('subfolder', file.subfolder || '');
    view.searchParams.set('type', file.type || 'output');
    const res = await fetch(view, { signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`拉取产物失败 ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length) throw new Error('产物是空文件');
    const dir = this.dirFor(workflowId ? 'workflows' : 'drafts', workflowId ? String(workflowId) : safeKey(draftKey));
    await fs.promises.mkdir(dir, { recursive: true });
    const existing = await fs.promises.readdir(dir);
    await Promise.all(existing.map(name => fs.promises.unlink(path.join(dir, name))));
    const ext = path.extname(filename) || (file.media_kind === 'video' ? '.mp4' : '.png');
    const stored = `latest${ext.toLowerCase()}`;
    await fs.promises.writeFile(path.join(dir, stored), bytes);
    return stored;
  }

  async sendFile(workflowId, draftKey) {
    const state = await this.currentState(workflowId, draftKey);
    if (!state?.file_name || state.status !== 'success') this.ctx.throw(404, '还没有预览产物');
    const dir = this.dirFor(workflowId ? 'workflows' : 'drafts', workflowId ? String(workflowId) : safeKey(draftKey));
    const absolute = path.resolve(dir, path.basename(state.file_name));
    if (path.dirname(absolute) !== dir || !fs.existsSync(absolute)) this.ctx.throw(404, '预览文件不在磁盘上');
    const ext = path.extname(absolute).toLowerCase();
    this.ctx.type = ext === '.mp4' || ext === '.webm' ? ext.slice(1) : 'png';
    this.ctx.body = fs.createReadStream(absolute);
  }
}

module.exports = WorkflowPreviewService;
