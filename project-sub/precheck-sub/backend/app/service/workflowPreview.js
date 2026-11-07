'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { parseApiWorkflow } = require('../lib/workflowParse');
const { buildSupplies } = require('../lib/supplyCatalog');
const { listPreviewFields, applyPreviewValues, collectMedia } = require('../lib/workflowPreview');
const { describeCallInputs, applyCallInputs, applySeed, withCallFields } = require('../lib/workflowInputs');
const { applyRefmod } = require('../lib/refmodApply');

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

function boardOf(raw) {
  if (!raw) return { runs: [] };
  if (Array.isArray(raw.runs)) {
    return { runs: raw.runs.filter(item => item && item.id).map(item => ({ ...item })) };
  }
  if (raw.status || raw.prompt_id || raw.file_name) {
    return { runs: [{ ...raw, id: String(raw.id || 'legacy') }] };
  }
  return { runs: [] };
}

const COMFY_CLIENT_ID = 'precheck-watch';

function comfyMessage(body, status) {
  const error = body?.error;
  if (!error) return `ComfyUI 返回 ${status}`;
  if (typeof error === 'string') return error;
  const nodeErrors = body?.node_errors ? JSON.stringify(body.node_errors).slice(0, 240) : '';
  return [ error.message || error.type || '', nodeErrors ].filter(Boolean).join(' ') || `ComfyUI 返回 ${status}`;
}

function sampleNode(nodes) {
  const list = Object.values(nodes || {}).filter(item => Number(item.max) > 0);
  const heavy = list.filter(item => Number(item.max) > 1);
  const pool = heavy.length ? heavy : list;
  const running = pool.filter(item => item.state === 'running');
  const chosen = (running.length ? running : pool)
    .sort((a, b) => Number(b.max) - Number(a.max))[0];
  return chosen || null;
}

async function socketText(data) {
  if (typeof data === 'string') return data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try { return await data.text(); } catch { return ''; }
  }
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return '';
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
      const existing = apiJson[slot.node_id]?.inputs?.image;
      const file = byId.get(slot.id);
      const payload = file?.data_base64 || file?.data;
      if (payload) {
        names[slot.id] = await this.uploadImage({ ...file, data_base64: payload }, `slot-${slot.node_id}`);
        continue;
      }
      const base = String(existing || '').split(/[/\\]/).pop();
      const placeholder = !base || [ 'reference.png', 'start.png', 'first.png', 'last.png', 'example.png' ].includes(base);
      if (!placeholder) continue;
      const error = new Error(`需要上传${slot.label}`);
      error.status = 400;
      throw error;
    }
    return names;
  }

  async bind(workflowId, payload) {
    const row = await this.ctx.service.workflow.show(workflowId);
    const positive = String(payload.positive ?? payload.positive_zh ?? '').trim();
    const negative = String(payload.negative ?? payload.negative_zh ?? '');
    if (!positive) {
      const error = new Error('需要一句正向提示词');
      error.status = 400;
      throw error;
    }
    let source = row.api_json;
    const refImages = Array.isArray(payload.ref_images) ? payload.ref_images : [];
    if (refImages.length) {
      const uploaded = [];
      for (const file of refImages) uploaded.push(await this.uploadImage(file, 'refmod'));
      source = applyRefmod(source, uploaded);
    }
    const names = await this.imageNames(source, payload.images || []);
    let graph = applySeed(applyCallInputs(source, { positive, negative, imageNames: names }), payload.seed);
    const seconds = Number(payload.duration_sec);
    if (Number.isFinite(seconds) && seconds > 0) {
      graph = applyPreviewValues(graph, [{ type: 'duration', key: 'duration_sec', value: seconds }]);
    }
    parseApiWorkflow(graph);
    return { prompt: graph, call_inputs: describeCallInputs(row.api_json) };
  }

  async start({ workflowId, draftKey, apiJson, values, refmodIds }) {
    let source = apiJson;
    if (Array.isArray(refmodIds) && refmodIds.length) {
      const files = await this.ctx.service.refmod.imageFiles(refmodIds);
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await this.uploadImage(file, 'refmod'));
      }
      source = applyRefmod(apiJson, uploaded);
    } else if (describeCallInputs(apiJson).images.length === 0
      && Object.values(apiJson || {}).some(node => node?.class_type === 'MiniMaxH3ReferenceToVideo')) {
      this.ctx.throw(400, '请选择至少一个包');
    }
    const names = await this.imageNames(source, (values || []).filter(item => item?.type === 'image'));
    const graph = applyCallInputs(applyPreviewValues(source, values), { imageNames: names });
    parseApiWorkflow(graph);
    let submitted;
    try {
      const res = await fetch(`${this.comfyBase()}/prompt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: graph, client_id: COMFY_CLIENT_ID }),
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
    const now = new Date().toISOString();
    const run = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
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
      created_at: now,
      updated_at: now,
    };
    const board = await this.withBoard(workflowId, draftKey, async () => {
      const current = await this.loadBoard(workflowId, draftKey);
      current.runs.unshift(run);
      await this.saveBoard(workflowId, draftKey, current);
      return current;
    });
    this.ensureWatcher();
    return { runs: board.runs };
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

  boardLocks() {
    if (!this.app.previewBoardLocks) this.app.previewBoardLocks = new Map();
    return this.app.previewBoardLocks;
  }

  async withBoard(workflowId, draftKey, fn) {
    const key = workflowId ? `workflow:${workflowId}` : `draft:${safeKey(draftKey)}`;
    const locks = this.boardLocks();
    const previous = locks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    locks.set(key, previous.catch(() => {}).then(() => gate));
    await previous.catch(() => {});
    try {
      return await fn();
    } finally {
      release();
    }
  }

  ensureWatcher() {
    const WS = global.WebSocket;
    if (typeof WS !== 'function') {
      if (!this.app.precheckComfyWatch) {
        this.app.precheckComfyWatch = { disabled: true };
        this.app.logger.warn('[precheck] 当前 Node 没有 WebSocket，无法同步 ComfyUI 步数');
      }
      return;
    }
    const socket = this.app.precheckComfySocket;
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) return;
    if (this.app.precheckComfyOpening) return;
    this.app.precheckComfyOpening = true;
    this.openProgressSocket(WS);
  }

  async soleRunningPrompt() {
    const now = Date.now();
    const cached = this.app.precheckSolePrompt;
    if (cached && now - cached.at < 4000) return cached.id;
    try {
      const res = await fetch(`${this.comfyBase()}/queue`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return '';
      const body = await res.json();
      const running = body.queue_running || [];
      const id = running.length === 1 ? String(running[0]?.[1] || '') : '';
      this.app.precheckSolePrompt = { at: now, id };
      return id;
    } catch {
      return '';
    }
  }

  openProgressSocket(WS) {
    const store = this.progressStore();
    const url = `${this.comfyBase().replace(/^http/, 'ws')}/ws?clientId=${COMFY_CLIENT_ID}`;
    let socket;
    try {
      socket = new WS(url);
    } catch (err) {
      this.app.precheckComfyOpening = false;
      this.app.logger.warn('[precheck] progress socket %s', err.message);
      setTimeout(() => this.ensureWatcher(), 5000);
      return;
    }
    this.app.precheckComfySocket = socket;
    let closed = false;
    const retry = () => {
      if (closed) return;
      closed = true;
      this.app.precheckComfyOpening = false;
      if (this.app.precheckComfySocket === socket) this.app.precheckComfySocket = null;
      setTimeout(() => this.ensureWatcher(), 3000);
    };
    let activePromptId = '';
    const remember = (promptId, patch) => {
      if (!promptId) return;
      const current = store.get(promptId) || { value: 0, max: 0, node: '', phase: 'running', error: '' };
      store.set(promptId, { ...current, ...patch });
    };
    socket.addEventListener('open', () => {
      this.app.precheckComfyOpening = false;
    });
    socket.addEventListener('message', (event) => {
      Promise.resolve(socketText(event.data)).then(async text => {
        if (!text || text[0] !== '{') return;
        let msg;
        try { msg = JSON.parse(text); } catch { return; }
        const data = msg?.data || {};
        if ((msg.type === 'execution_start' || msg.type === 'executing') && data.prompt_id) {
          activePromptId = data.prompt_id;
        }
        let promptId = data.prompt_id || activePromptId;
        if (!promptId) {
          promptId = await this.soleRunningPrompt();
          if (promptId) activePromptId = promptId;
        }
        if (!promptId) return;
        const current = store.get(promptId) || { value: 0, max: 0, node: '', phase: 'running', error: '' };
        if (msg.type === 'progress') {
          remember(promptId, {
            value: Number(data.value) || 0,
            max: Number(data.max) || 0,
            node: data.node || current.node,
            phase: 'running',
            error: '',
          });
        } else if (msg.type === 'progress_state') {
          const sample = sampleNode(data.nodes);
          if (!sample) return;
          remember(promptId, {
            value: Number(sample.value) || 0,
            max: Number(sample.max) || 0,
            node: sample.display_node_id || sample.node_id || current.node,
            phase: sample.state === 'error' ? 'error' : 'running',
            error: sample.state === 'error' ? (current.error || 'ComfyUI 执行失败') : '',
          });
        } else if (msg.type === 'executing') {
          remember(promptId, {
            node: data.node || current.node || '',
            phase: data.node ? 'running' : current.phase,
          });
        } else if (msg.type === 'execution_error') {
          remember(promptId, {
            phase: 'error',
            node: data.node_id || current.node,
            error: String(data.exception_message || 'ComfyUI 执行失败').slice(0, 400),
          });
        }
      }).catch(() => {});
    });
    socket.addEventListener('error', (err) => {
      this.app.logger.warn('[precheck] progress socket %s', err.message || err);
      retry();
      try { socket.close(); } catch { /* 已经关闭 */ }
    });
    socket.addEventListener('close', retry);
  }

  placeOf(body, promptId) {
    if (!body) return null;
    const running = body.queue_running || [];
    const pending = body.queue_pending || [];
    if (running.some(row => row?.[1] === promptId)) return { phase: 'running', ahead: 0 };
    const index = pending.findIndex(row => row?.[1] === promptId);
    if (index >= 0) return { phase: 'queued', ahead: index + 1 };
    return { phase: 'unknown', ahead: 0 };
  }

  progressView(promptId, queueBody) {
    const live = this.progressStore().get(promptId);
    const place = this.placeOf(queueBody, promptId);
    const max = live && Number(live.max) > 0 ? Number(live.max) : 0;
    const value = live && Number.isFinite(Number(live.value)) ? Number(live.value) : 0;
    const percent = max > 0 ? Math.min(99, Math.round((value / max) * 100)) : 0;
    let phase = 'unknown';
    if (live?.phase === 'error') phase = 'error';
    else if (place?.phase === 'queued') phase = 'queued';
    else if (place?.phase === 'running' || live?.phase === 'running') phase = 'running';
    return {
      phase,
      queue_ahead: place?.ahead || 0,
      progress_value: value,
      progress_max: max,
      progress_percent: percent,
      node: live?.node || '',
      error: phase === 'error' ? (live?.error || 'ComfyUI 执行失败') : '',
    };
  }

  async queueBody() {
    try {
      const res = await fetch(`${this.comfyBase()}/queue`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      this.ctx.logger.warn('[precheck] queue %s', err.message);
      return null;
    }
  }

  async progress(promptIds) {
    this.ensureWatcher();
    const ids = [ ...new Set((promptIds || []).filter(Boolean)) ];
    const queue = ids.length ? await this.queueBody() : null;
    const data = {};
    ids.forEach(id => {
      data[id] = this.progressView(id, queue);
    });
    return data;
  }

  async decorate(state, workflowId, draftKey) {
    if (!state || state.status !== 'running' || !state.prompt_id) return state;
    this.ensureWatcher();
    const view = this.progressView(state.prompt_id, await this.queueBody());
    if (view.phase === 'error') {
      return this.patchRun(workflowId, draftKey, state.id, {
        status: 'failed',
        phase: 'error',
        error: view.error || 'ComfyUI 执行失败',
        updated_at: new Date().toISOString(),
      }) || state;
    }
    const phase = view.phase === 'unknown' ? (state.phase || 'running') : view.phase;
    const next = {
      ...state,
      phase,
      queue_ahead: view.queue_ahead,
      progress_value: view.progress_max > 0 ? view.progress_value : (Number(state.progress_value) || 0),
      progress_max: view.progress_max > 0 ? view.progress_max : (Number(state.progress_max) || 0),
      progress_percent: view.progress_max > 0
        ? view.progress_percent
        : (Number(state.progress_percent) || 0),
      node: view.node || state.node || '',
    };
    const changed = next.phase !== state.phase
      || next.queue_ahead !== state.queue_ahead
      || next.progress_value !== state.progress_value
      || next.progress_max !== state.progress_max
      || next.node !== state.node;
    if (!changed) return next;
    return await this.patchRun(workflowId, draftKey, state.id, next) || next;
  }

  async loadBoard(workflowId, draftKey) {
    if (workflowId) {
      const row = await this.ctx.service.workflow.show(workflowId);
      return boardOf(row.preview_json);
    }
    return boardOf(this.drafts().get(safeKey(draftKey)));
  }

  async saveBoard(workflowId, draftKey, board) {
    const stored = { runs: board.runs || [] };
    if (workflowId) {
      const row = await this.ctx.service.workflow.show(workflowId);
      await row.update({ preview_json: stored });
      return;
    }
    this.drafts().set(safeKey(draftKey), stored);
  }

  async patchRun(workflowId, draftKey, id, next) {
    return this.withBoard(workflowId, draftKey, async () => {
      const board = await this.loadBoard(workflowId, draftKey);
      const index = board.runs.findIndex(item => item.id === id);
      if (index < 0) return null;
      const current = board.runs[index];
      if (next.prompt_id && current.prompt_id && current.prompt_id !== next.prompt_id) return current;
      if (current.status !== 'running' && current.status !== next.status) return current;
      board.runs[index] = { ...current, ...next, id: current.id };
      await this.saveBoard(workflowId, draftKey, board);
      return board.runs[index];
    });
  }

  async read(workflowId, draftKey) {
    const board = await this.loadBoard(workflowId, draftKey);
    const runs = [];
    for (const run of board.runs) {
      let next = run;
      if (next.status === 'running' && next.prompt_id) {
        next = await this.settle(workflowId, draftKey, next);
        if (next?.status === 'running') next = await this.decorate(workflowId, draftKey, next);
      }
      if (next) runs.push(next);
    }
    const latest = await this.loadBoard(workflowId, draftKey);
    const settled = new Map(runs.map(item => [ item.id, item ]));
    const merged = latest.runs.map(item => settled.get(item.id) || item);
    settled.forEach((item, id) => {
      if (!latest.runs.some(run => run.id === id)) merged.push(item);
    });
    return { runs: merged };
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
    const latest = (await this.loadBoard(workflowId, draftKey)).runs.find(run => run.id === state.id);
    if (!latest || latest.prompt_id !== state.prompt_id) return latest || state;
    if (item.status?.status_str === 'error') {
      return this.patchRun(workflowId, draftKey, latest.id, {
        status: 'failed',
        error: 'ComfyUI 执行失败',
        updated_at: new Date().toISOString(),
      });
    }
    if (!item.status?.completed && item.status?.status_str !== 'success') return latest;
    const files = collectMedia(item.outputs);
    const file = files[files.length - 1];
    if (!file) {
      return this.patchRun(workflowId, draftKey, latest.id, {
        status: 'failed',
        error: 'ComfyUI 没有返回图片或视频',
        updated_at: new Date().toISOString(),
      });
    }
    try {
      const saved = await this.saveFile(workflowId, draftKey, latest, file);
      const again = (await this.loadBoard(workflowId, draftKey)).runs.find(run => run.id === state.id);
      if (!again || again.prompt_id !== state.prompt_id) return again || state;
      return this.patchRun(workflowId, draftKey, again.id, {
        status: 'success',
        error: '',
        media_kind: file.media_kind,
        file_name: saved,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      return this.patchRun(workflowId, draftKey, latest.id, {
        status: 'failed',
        error: err.message,
        updated_at: new Date().toISOString(),
      });
    }
  }

  async saveFile(workflowId, draftKey, run, file) {
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
    const ext = path.extname(filename) || (file.media_kind === 'video' ? '.mp4' : '.png');
    const stored = run.id === 'legacy' && run.file_name
      ? path.basename(run.file_name)
      : `${run.id}${ext.toLowerCase()}`;
    await fs.promises.writeFile(path.join(dir, stored), bytes);
    return stored;
  }

  async removeRun(workflowId, draftKey, runId) {
    const board = await this.loadBoard(workflowId, draftKey);
    const run = board.runs.find(item => item.id === String(runId || ''));
    if (!run) this.ctx.throw(404, '产物不存在');
    if (run.status === 'running') this.ctx.throw(400, '正在生成的产物不能删除');
    if (run.file_name) {
      const dir = this.dirFor(workflowId ? 'workflows' : 'drafts', workflowId ? String(workflowId) : safeKey(draftKey));
      const absolute = path.resolve(dir, path.basename(run.file_name));
      if (path.dirname(absolute) === dir && fs.existsSync(absolute)) {
        await fs.promises.unlink(absolute);
      }
    }
    await this.withBoard(workflowId, draftKey, async () => {
      const current = await this.loadBoard(workflowId, draftKey);
      current.runs = current.runs.filter(item => item.id !== run.id);
      await this.saveBoard(workflowId, draftKey, current);
    });
    return { id: run.id };
  }

  async sendFile(workflowId, draftKey, runId) {
    const board = await this.loadBoard(workflowId, draftKey);
    const run = runId
      ? board.runs.find(item => item.id === String(runId))
      : board.runs.find(item => item.status === 'success' && item.file_name);
    if (!run?.file_name || run.status !== 'success') this.ctx.throw(404, '还没有预览产物');
    const dir = this.dirFor(workflowId ? 'workflows' : 'drafts', workflowId ? String(workflowId) : safeKey(draftKey));
    const absolute = path.resolve(dir, path.basename(run.file_name));
    if (path.dirname(absolute) !== dir || !fs.existsSync(absolute)) this.ctx.throw(404, '预览文件不在磁盘上');
    const ext = path.extname(absolute).toLowerCase();
    this.ctx.type = ext === '.mp4' || ext === '.webm' ? ext.slice(1) : 'png';
    this.ctx.body = fs.createReadStream(absolute);
  }
}

module.exports = WorkflowPreviewService;
