'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { parseApiWorkflow } = require('../lib/workflowParse');
const { buildSupplies } = require('../lib/supplyCatalog');
const { listPreviewFields, applyPreviewValues, collectMedia } = require('../lib/workflowPreview');
const { describeCallInputs, applyCallInputs, withCallFields } = require('../lib/workflowInputs');

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
    return withCallFields(listPreviewFields(apiJson), apiJson);
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

  decodeImage(file) {
    const raw = String(file?.data_base64 || file?.data || '');
    const marker = ';base64,';
    const encoded = raw.includes(marker) ? raw.slice(raw.indexOf(marker) + marker.length) : raw;
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length) {
      const error = new Error('图片是空的');
      error.status = 400;
      throw error;
    }
    if (bytes.length > 12 * 1024 * 1024) {
      const error = new Error('图片超过 12MB');
      error.status = 400;
      throw error;
    }
    const ext = String(file.filename || '').toLowerCase().match(/\.(png|jpe?g|webp)$/);
    return { bytes, ext: ext ? ext[0].replace('jpeg', 'jpg') : '.png' };
  }

  async uploadImage(file, prefix) {
    const image = this.decodeImage(file);
    const filename = `${prefix}-${Date.now()}${image.ext}`.replace(/[^\w.-]/g, '');
    const boundary = `----precheck${Date.now()}`;
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n`
      + `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\n`
      + `Content-Type: application/octet-stream\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const res = await fetch(`${this.comfyBase()}/upload/image`, {
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body: Buffer.concat([ head, image.bytes, tail ]),
      signal: AbortSignal.timeout(60000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.name) {
      const error = new Error(body.error || `上传图片到 ComfyUI 失败 ${res.status}`);
      error.status = 502;
      throw error;
    }
    return body.subfolder ? `${body.subfolder}/${body.name}` : body.name;
  }

  async imageNames(apiJson, images) {
    const call = describeCallInputs(apiJson);
    const byId = new Map((images || []).map(item => [ item.slot_id || item.id, item ]));
    const names = {};
    for (const slot of call.images) {
      const file = byId.get(slot.id);
      const payload = file?.data_base64 || file?.data;
      if (!payload) {
        const error = new Error(`需要上传${slot.label}`);
        error.status = 400;
        throw error;
      }
      names[slot.id] = await this.uploadImage({ ...file, data_base64: payload }, `slot-${slot.node_id}`);
    }
    return names;
  }

  async bind(workflowId, payload) {
    const row = await this.ctx.service.workflow.show(workflowId);
    const positive = String(payload.positive ?? payload.positive_zh ?? '').trim();
    if (!positive) {
      const error = new Error('需要一句正向提示词');
      error.status = 400;
      throw error;
    }
    const names = await this.imageNames(row.api_json, payload.images || []);
    const graph = applyCallInputs(row.api_json, { positive, imageNames: names });
    parseApiWorkflow(graph);
    return { prompt: graph, call_inputs: describeCallInputs(row.api_json) };
  }

  async start({ workflowId, draftKey, apiJson, values }) {
    const names = await this.imageNames(apiJson, (values || []).filter(item => item?.type === 'image'));
    const graph = applyCallInputs(applyPreviewValues(apiJson, values), { imageNames: names });
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
      phase: 'queued',
      prompt_id: submitted.prompt_id,
      error: '',
      media_kind: '',
      file_name: '',
      progress_percent: 0,
      progress_value: 0,
      progress_max: 0,
      queue_ahead: 0,
      node: '',
      submitted: this.summarizeValues(values),
      updated_at: new Date().toISOString(),
    };
    await this.writeState(workflowId, draftKey, state);
    this.ensureWatcher();
    return state;
  }

  summarizeValues(values) {
    return (values || []).map((field) => {
      if (field?.type === 'image') {
        return { label: field.label || '图片', type: 'image', text: field.filename || '已上传图片' };
      }
      const text = String(field?.value ?? '').trim();
      if (!text) return null;
      return {
        label: field.label || field.key || '参数',
        type: field.type || 'text',
        text: text.length > 180 ? `${text.slice(0, 180)}…` : text,
      };
    }).filter(Boolean);
  }

  progressStore() {
    if (!this.app.precheckPromptProgress) this.app.precheckPromptProgress = new Map();
    return this.app.precheckPromptProgress;
  }

  ensureWatcher() {
    if (this.app.precheckComfyWatch) return;
    const WS = global.WebSocket;
    if (typeof WS !== 'function') {
      this.app.precheckComfyWatch = { disabled: true };
      return;
    }
    const store = this.progressStore();
    const url = `${this.comfyBase().replace(/^http/, 'ws')}/ws?clientId=precheck-watch`;
    const open = () => {
      let socket;
      try {
        socket = new WS(url);
      } catch (err) {
        this.app.logger.warn('[precheck] progress socket %s', err.message);
        setTimeout(open, 5000);
        return;
      }
      socket.addEventListener('message', (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        const data = msg?.data || {};
        const promptId = data.prompt_id;
        if (!promptId) return;
        const current = store.get(promptId) || { value: 0, max: 0, node: '', phase: 'running' };
        if (msg.type === 'progress') {
          store.set(promptId, {
            ...current,
            value: Number(data.value) || 0,
            max: Number(data.max) || 0,
            node: data.node || current.node,
            phase: 'running',
          });
        } else if (msg.type === 'executing') {
          store.set(promptId, {
            ...current,
            node: data.node || '',
            phase: data.node ? 'running' : current.phase,
          });
        }
      });
      socket.addEventListener('close', () => setTimeout(open, 3000));
      this.app.precheckComfySocket = socket;
    };
    this.app.precheckComfyWatch = { started: true };
    open();
  }

  async queueOf(promptId) {
    try {
      const res = await fetch(`${this.comfyBase()}/queue`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const body = await res.json();
      const running = body.queue_running || [];
      const pending = body.queue_pending || [];
      if (running.some((row) => row?.[1] === promptId)) return { phase: 'running', ahead: 0 };
      const index = pending.findIndex((row) => row?.[1] === promptId);
      if (index >= 0) return { phase: 'queued', ahead: index + 1 };
      return { phase: 'unknown', ahead: 0 };
    } catch (err) {
      this.ctx.logger.warn('[precheck] queue %s', err.message);
      return null;
    }
  }

  async decorate(state, workflowId, draftKey) {
    if (!state || state.status !== 'running' || !state.prompt_id) return state;
    this.ensureWatcher();
    const live = this.progressStore().get(state.prompt_id);
    const queue = await this.queueOf(state.prompt_id);
    const max = live && Number(live.max) > 0 ? Number(live.max) : (Number(state.progress_max) || 0);
    const value = live && Number.isFinite(Number(live.value)) ? Number(live.value) : (Number(state.progress_value) || 0);
    const percent = max > 0 ? Math.min(99, Math.round((value / max) * 100)) : 0;
    const phase = queue?.phase === 'queued' ? 'queued' : (live?.phase || (queue?.phase === 'running' ? 'running' : state.phase || 'running'));
    const next = {
      ...state,
      phase,
      queue_ahead: queue?.ahead || 0,
      progress_value: value,
      progress_max: max,
      progress_percent: percent,
      node: live?.node || state.node || '',
    };
    const changed = next.phase !== state.phase
      || next.queue_ahead !== state.queue_ahead
      || next.progress_value !== state.progress_value
      || next.progress_max !== state.progress_max
      || next.node !== state.node;
    if (changed) await this.writeState(workflowId, draftKey, next);
    return next;
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
    return this.decorate(state, workflowId, draftKey);
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
