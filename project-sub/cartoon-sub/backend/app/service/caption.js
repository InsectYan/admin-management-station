'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function unwrap(json) {
  if (json && Object.prototype.hasOwnProperty.call(json, 'data')) return json.data;
  return json;
}

function mediaOfName(name) {
  return /视频/.test(String(name || '')) ? 'video' : 'image';
}

function decodeMedia(file) {
  const raw = String(file?.data || file?.data_base64 || '');
  const marker = ';base64,';
  const encoded = raw.includes(marker) ? raw.slice(raw.indexOf(marker) + marker.length) : raw;
  const bytes = Buffer.from(encoded, 'base64');
  const original = path.basename(String(file?.filename || 'file'));
  const lower = original.toLowerCase();
  const video = lower.match(/\.(mp4|webm|mov)$/);
  const image = lower.match(/\.(png|jpe?g|webp)$/);
  if (!video && !image) {
    const error = new Error('请上传 png、jpg、webp 图片，或 mp4、webm、mov 视频');
    error.status = 400;
    throw error;
  }
  if (!bytes.length) {
    const error = new Error(video ? '视频是空的' : '图片是空的');
    error.status = 400;
    throw error;
  }
  const limit = video ? 64 * 1024 * 1024 : 12 * 1024 * 1024;
  if (bytes.length > limit) {
    const error = new Error(video ? '视频超过 64MB' : '图片超过 12MB');
    error.status = 400;
    throw error;
  }
  const ext = video ? video[0] : (lower.endsWith('.png') ? '.png' : lower.endsWith('.webp') ? '.webp' : '.jpg');
  return { bytes, ext, media_kind: video ? 'video' : 'image', original_name: original.slice(0, 240) };
}

function collectText(outputs) {
  const parts = [];
  const push = (value) => {
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    const text = String(value ?? '').trim();
    if (text) parts.push(text);
  };
  Object.values(outputs || {}).forEach(entry => {
    push(entry?.text);
    push(entry?.tags);
    push(entry?.caption);
  });
  return [ ...new Set(parts) ].join('\n');
}

function applyCaption(graph, { filename, media, extra }) {
  const copy = JSON.parse(JSON.stringify(graph || {}));
  let attached = false;
  Object.values(copy).forEach(node => {
    const inputs = node?.inputs;
    if (!inputs) return;
    if (media === 'video' && node.class_type === 'LoadVideo' && typeof inputs.file === 'string') {
      inputs.file = filename;
      attached = true;
    }
    if (media === 'image' && (node.class_type === 'LoadImage' || node.class_type === 'LoadImageMask') && typeof inputs.image === 'string') {
      inputs.image = filename;
      attached = true;
    }
    if (extra && typeof inputs.custom_prompt === 'string') inputs.custom_prompt = extra;
    if (extra && typeof inputs.text_input === 'string') inputs.text_input = extra;
  });
  if (!attached) {
    const error = new Error(media === 'video' ? '这条工作流不接收视频' : '这条工作流不接收图片');
    error.status = 400;
    throw error;
  }
  return copy;
}

class CaptionService extends Service {
  precheckBase() {
    return this.config.precheck.baseUrl.replace(/\/$/, '');
  }

  comfyBase() {
    return this.config.comfy.baseUrl.replace(/\/$/, '');
  }

  present(row) {
    return {
      id: row.id,
      project_id: row.project_id,
      media_kind: row.media_kind,
      original_name: row.original_name || '',
      extra_prompt: row.extra_prompt || '',
      result_prompt: row.result_prompt || '',
      shared_extra: row.shared_extra || '',
      workflow_id: row.workflow_id || null,
      workflow_name: row.workflow_name || '',
      status: row.status,
      phase: row.phase || '',
      progress_value: row.progress_value || 0,
      progress_max: row.progress_max || 0,
      progress_percent: row.progress_percent || 0,
      node: row.node || '',
      error_message: row.error_message || '',
      saved: Boolean(row.saved),
      created_at: row.created_at,
    };
  }

  jobOf(cards) {
    const queued = cards.filter(item => item.status === 'queued');
    const running = cards.find(item => item.status === 'running') || null;
    const active = Boolean(running || queued.length);
    const waiting = Boolean(running && !(Number(running.progress_max) > 0));
    let note = '';
    if (running) {
      const name = running.original_name || '这条素材';
      const step = running.progress_max > 0 ? ` ${running.progress_value}/${running.progress_max}` : '';
      const behind = queued.length ? `，后面还有 ${queued.length} 个` : '';
      note = `正在反推 ${name}${step}${behind}`;
    } else if (queued.length) {
      note = `排队中，还有 ${queued.length} 个`;
    }
    return {
      active,
      waiting,
      percent: running ? (Number(running.progress_percent) || 0) : 0,
      note,
      running_id: running?.id || null,
    };
  }

  async board(projectId) {
    await this.ctx.service.project.show(projectId);
    const [ row ] = await this.ctx.model.CaptionBoard.findOrCreate({
      where: { project_id: Number(projectId) },
      defaults: { project_id: Number(projectId), shared_prompt: '' },
    });
    return row;
  }

  async cardsOf(projectId) {
    return this.ctx.model.CaptionCard.findAll({
      where: { project_id: Number(projectId) },
      order: [[ 'id', 'ASC' ]],
    });
  }

  async workflows() {
    const cached = this.app.captionWorkflowChoices;
    if (cached && Date.now() - cached.at < 20000) return cached.rows;
    const res = await fetch(`${this.precheckBase()}/api/workflows`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`预检返回 ${res.status}`);
    const rows = unwrap(await res.json()) || [];
    const list = rows
      .filter(row => row?.category === 'image_to_prompt' || String(row?.name || '').startsWith('反推'))
      .map(row => ({
        id: row.id,
        name: row.name,
        media: mediaOfName(row.name),
      }))
      .sort((a, b) => a.id - b.id);
    this.app.captionWorkflowChoices = { at: Date.now(), rows: list };
    return list;
  }

  async show(projectId) {
    const board = await this.board(projectId);
    const cards = await this.cardsOf(projectId);
    let workflows = [];
    let workflowsError = '';
    try {
      workflows = await this.workflows();
    } catch (err) {
      workflowsError = err.message;
    }
    const presented = cards.map(item => this.present(item));
    return {
      shared_prompt: board.shared_prompt || '',
      workflow_id: board.workflow_id || null,
      workflows,
      workflows_error: workflowsError,
      cards: presented,
      job: this.jobOf(presented),
    };
  }

  async save(projectId, payload) {
    const board = await this.board(projectId);
    const workflowId = Number(payload.workflow_id);
    await board.update({
      shared_prompt: payload.shared_prompt == null ? board.shared_prompt : String(payload.shared_prompt),
      workflow_id: Number.isInteger(workflowId) && workflowId > 0 ? workflowId : board.workflow_id,
    });
    const rows = Array.isArray(payload.cards) ? payload.cards : [];
    for (const item of rows) {
      const card = await this.ctx.model.CaptionCard.findOne({
        where: { id: item.id, project_id: Number(projectId) },
      });
      if (!card) continue;
      await card.update({
        extra_prompt: item.extra_prompt == null ? card.extra_prompt : String(item.extra_prompt),
        result_prompt: item.result_prompt == null ? card.result_prompt : String(item.result_prompt),
        saved: true,
      });
    }
    return this.show(projectId);
  }

  async upload(projectId, file) {
    await this.board(projectId);
    const media = decodeMedia(file);
    const dir = path.join(outputRoot(this.app), 'captions', String(projectId));
    fs.mkdirSync(dir, { recursive: true });
    const stored = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${media.ext}`;
    fs.writeFileSync(path.join(dir, stored), media.bytes);
    await this.ctx.model.CaptionCard.create({
      project_id: Number(projectId),
      media_kind: media.media_kind,
      stored_name: stored,
      original_name: media.original_name,
      status: 'idle',
    });
    return this.show(projectId);
  }

  async remove(projectId, cardId) {
    const card = await this.ctx.model.CaptionCard.findOne({
      where: { id: cardId, project_id: Number(projectId) },
    });
    if (!card) this.ctx.throw(404, '这条素材不存在');
    if ([ 'queued', 'running' ].includes(card.status)) this.ctx.throw(400, '这条正在反推，先等它结束');
    const absolute = resolveInside(outputRoot(this.app), path.join('captions', String(projectId), card.stored_name));
    if (absolute) fs.rmSync(absolute, { force: true });
    await card.destroy();
    return this.show(projectId);
  }

  filePath(projectId, card) {
    const absolute = resolveInside(outputRoot(this.app), path.join('captions', String(projectId), card.stored_name));
    if (!absolute || !fs.existsSync(absolute)) this.ctx.throw(404, '文件不存在');
    return absolute;
  }

  async sendFile(projectId, cardId) {
    const card = await this.ctx.model.CaptionCard.findOne({
      where: { id: cardId, project_id: Number(projectId) },
    });
    if (!card) this.ctx.throw(404, '这条素材不存在');
    const absolute = this.filePath(projectId, card);
    this.ctx.type = path.extname(absolute).replace('.', '') || 'octet-stream';
    this.ctx.body = fs.createReadStream(absolute);
  }

  async workflowById(workflowId) {
    const rows = await this.workflows();
    const found = rows.find(item => Number(item.id) === Number(workflowId));
    if (!found) this.ctx.throw(400, '反推工作流不存在');
    return found;
  }

  async queueCard(card, workflow, shared) {
    await card.update({
      status: 'queued',
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      shared_extra: shared,
      prompt_id: null,
      phase: 'queued',
      progress_value: 0,
      progress_max: 0,
      progress_percent: 0,
      node: '',
      error_message: '',
    });
  }

  async run(projectId, cardId, payload) {
    const board = await this.board(projectId);
    const card = await this.ctx.model.CaptionCard.findOne({
      where: { id: cardId, project_id: Number(projectId) },
    });
    if (!card) this.ctx.throw(404, '这条素材不存在');
    if ([ 'queued', 'running' ].includes(card.status)) return this.show(projectId);
    const workflowId = Number(payload.workflow_id || card.workflow_id);
    const workflow = await this.workflowById(workflowId);
    if (workflow.media !== card.media_kind) {
      this.ctx.throw(400, workflow.media === 'video' ? '这条工作流只接受视频' : '这条工作流只接受图片');
    }
    if (payload.extra_prompt != null) await card.update({ extra_prompt: String(payload.extra_prompt) });
    const shared = payload.shared_prompt == null ? String(board.shared_prompt || '') : String(payload.shared_prompt);
    if (payload.update_shared) {
      await board.update({ shared_prompt: shared, workflow_id: workflow.id });
    }
    await this.queueCard(card, workflow, shared.trim());
    this.kick();
    return this.show(projectId);
  }

  async runEmpty(projectId, payload) {
    const board = await this.board(projectId);
    const workflow = await this.workflowById(payload.workflow_id);
    const shared = payload.shared_prompt == null ? String(board.shared_prompt || '') : String(payload.shared_prompt);
    await board.update({ shared_prompt: shared, workflow_id: workflow.id });
    const cards = await this.cardsOf(projectId);
    const targets = cards.filter(card => {
      if ([ 'queued', 'running' ].includes(card.status)) return false;
      if (card.media_kind !== workflow.media) return false;
      return !String(card.result_prompt || '').trim();
    });
    if (!targets.length) this.ctx.throw(400, '没有和这条工作流匹配、且提示词还空着的卡片');
    for (const card of targets) {
      if (payload.cards) {
        const edited = payload.cards.find(item => Number(item.id) === card.id);
        if (edited?.extra_prompt != null) await card.update({ extra_prompt: String(edited.extra_prompt) });
      }
      await this.queueCard(card, workflow, shared.trim());
    }
    this.kick();
    return this.show(projectId);
  }

  kick() {
    const app = this.app;
    if (app.captionRunning) return;
    app.captionRunning = true;
    setImmediate(async () => {
      const ctx = app.createAnonymousContext();
      try {
        await ctx.service.caption.drain();
      } catch (err) {
        app.logger.warn('[cartoon] caption %s', err.message);
      } finally {
        app.captionRunning = false;
        const left = await ctx.model.CaptionCard.count({ where: { status: [ 'queued', 'running' ] } });
        if (left) ctx.service.caption.kick();
      }
    });
  }

  async drain() {
    for (;;) {
      const running = await this.ctx.model.CaptionCard.findOne({
        where: { status: 'running' },
        order: [[ 'id', 'ASC' ]],
      });
      const card = running || await this.ctx.model.CaptionCard.findOne({
        where: { status: 'queued' },
        order: [[ 'id', 'ASC' ]],
      });
      if (!card) return;
      try {
        await this.finish(card);
      } catch (err) {
        this.ctx.logger.warn('[cartoon] caption card %s %s', card.id, err.message);
        await card.update({
          status: 'failed',
          phase: 'error',
          error_message: String(err.message || '反推失败').slice(0, 400),
        }).catch(() => {});
        await this.stopBatch(card.project_id);
      }
    }
  }

  async stopBatch(projectId) {
    await this.ctx.model.CaptionCard.update(
      { status: 'idle', phase: '', error_message: '' },
      { where: { project_id: projectId, status: 'queued' } },
    );
  }

  async finish(card) {
    let current = await card.reload();
    if (![ 'queued', 'running' ].includes(current.status)) return;
    if (current.status === 'queued' || !current.prompt_id) current = await this.submit(current);
    const started = Date.now();
    while (Date.now() - started < 20 * 60 * 1000) {
      current = await current.reload();
      if (![ 'queued', 'running' ].includes(current.status)) return;
      const done = await this.settle(current);
      if (done) return;
      await sleep(2000);
    }
    const error = new Error('反推超时');
    error.status = 504;
    throw error;
  }

  async submit(card) {
    const workflow = await this.workflowById(card.workflow_id);
    if (workflow.media !== card.media_kind) {
      const error = new Error(workflow.media === 'video' ? '这条工作流只接受视频' : '这条工作流只接受图片');
      error.status = 400;
      throw error;
    }
    const detailRes = await fetch(`${this.precheckBase()}/api/workflows/${workflow.id}`, { signal: AbortSignal.timeout(20000) });
    if (!detailRes.ok) throw new Error(`预检返回 ${detailRes.status}`);
    const detail = unwrap(await detailRes.json());
    const depRes = await fetch(`${this.precheckBase()}/api/workflows/${workflow.id}/dependencies`, { signal: AbortSignal.timeout(20000) });
    if (depRes.ok) {
      const diff = unwrap(await depRes.json()) || {};
      if (diff.online === false) throw new Error(`连不上 ComfyUI：${diff.error || '离线'}`);
      if ((diff.missing_nodes || []).length) throw new Error(`缺失节点 ${diff.missing_nodes.join('、')}`);
      if ((diff.missing_models || []).length) {
        throw new Error(`缺失模型 ${diff.missing_models.map(item => item.name).join('、')}`);
      }
    }
    const absolute = this.filePath(card.project_id, card);
    const uploaded = await this.uploadComfy(absolute, card.media_kind);
    const own = String(card.extra_prompt || '').trim();
    const shared = String(card.shared_extra || '').trim();
    const graph = applyCaption(detail.api_json, {
      filename: uploaded,
      media: card.media_kind,
      extra: own || shared,
    });
    const res = await fetch(`${this.comfyBase()}/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: graph, client_id: 'precheck-watch' }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.prompt_id) {
      const message = body?.error?.message || body?.error || `ComfyUI 返回 ${res.status}`;
      throw new Error(typeof message === 'string' ? message : 'ComfyUI 没有收下这条反推');
    }
    await card.update({
      status: 'running',
      prompt_id: body.prompt_id,
      workflow_name: workflow.name,
      phase: 'running',
      error_message: '',
    });
    return card.reload();
  }

  async uploadComfy(absolute, kind) {
    const filename = `caption-${Date.now()}${path.extname(absolute)}`.replace(/[^\w.-]/g, '');
    const bytes = fs.readFileSync(absolute);
    const boundary = `----caption${Date.now()}`;
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n`
      + `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\n`
      + `Content-Type: application/octet-stream\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const res = await fetch(`${this.comfyBase()}/upload/image`, {
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body: Buffer.concat([ head, bytes, tail ]),
      signal: AbortSignal.timeout(120000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.name) throw new Error(body.error || `上传${kind === 'video' ? '视频' : '图片'}到 ComfyUI 失败`);
    return body.subfolder ? `${body.subfolder}/${body.name}` : body.name;
  }

  async settle(card) {
    if (!card.prompt_id) return false;
    let item;
    try {
      const res = await fetch(`${this.comfyBase()}/history/${card.prompt_id}`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const history = await res.json();
        item = history[card.prompt_id];
      }
    } catch (err) {
      this.ctx.logger.warn('[cartoon] caption history %s', err.message);
    }
    if (item?.status?.status_str === 'error') {
      await card.update({ status: 'failed', phase: 'error', error_message: 'ComfyUI 执行失败' });
      await this.stopBatch(card.project_id);
      return true;
    }
    if (item && (item.status?.completed || item.status?.status_str === 'success')) {
      const text = collectText(item.outputs);
      if (!text) {
        await card.update({ status: 'failed', phase: 'error', error_message: '没有返回提示词' });
        await this.stopBatch(card.project_id);
        return true;
      }
      await card.update({
        status: 'success',
        phase: 'done',
        result_prompt: text,
        error_message: '',
        progress_percent: 100,
      });
      return true;
    }
    const view = await this.liveProgress(card.prompt_id);
    await card.update({
      phase: view.phase === 'queued' ? 'queued' : 'running',
      progress_value: Number(view.progress_value) || 0,
      progress_max: Number(view.progress_max) || 0,
      progress_percent: Number(view.progress_percent) || 0,
      node: view.node || '',
    });
    return false;
  }

  async liveProgress(promptId) {
    try {
      const res = await fetch(`${this.precheckBase()}/api/comfy/progress?prompt_id=${encodeURIComponent(promptId)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return {};
      const data = unwrap(await res.json()) || {};
      return data[promptId] || {};
    } catch (err) {
      this.ctx.logger.warn('[cartoon] caption progress %s', err.message);
      return {};
    }
  }

  async library() {
    const rows = await this.ctx.model.CaptionCard.findAll({
      where: { saved: true },
      order: [[ 'id', 'DESC' ]],
      limit: 200,
    });
    const projects = await this.ctx.service.library.names([ ...new Set(rows.map(row => row.project_id)) ]);
    return rows.map(row => {
      const project = projects.get(row.project_id);
      return {
        ...this.present(row),
        project_name: project?.name || '',
        project_deleted: !project || Boolean(project.deleted_at),
      };
    });
  }
}

module.exports = CaptionService;
