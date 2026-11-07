'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');
const { reportAudit } = require('../lib/reportAudit');
const { complianceCheck } = require('../lib/complianceCheck');
const { begin, finish, cancelProject } = require('../lib/activeRuns');
const { usageSummary } = require('../lib/usageSummary');

function unwrap(json) {
  if (json && Object.prototype.hasOwnProperty.call(json, 'data')) return json.data;
  return json;
}

function collectMedia(outputs) {
  const files = [];
  Object.values(outputs || {}).forEach(entry => {
    (entry?.images || []).forEach(file => {
      const video = /\.(mp4|webm|mkv)$/i.test(file.filename || '');
      files.push({ ...file, media_kind: video ? 'video' : 'image' });
    });
    (entry?.gifs || []).forEach(file => files.push({ ...file, media_kind: 'video' }));
    (entry?.videos || []).forEach(file => files.push({ ...file, media_kind: 'video' }));
  });
  return files;
}

const FIXTURES = [
  { kind: 'image', name: '文生图夹具', file: 't2i-cartoon-v1.api.json', category: 'text_to_image' },
  { kind: 'video', name: '首尾帧夹具', file: 'flf2v-cartoon-v1.api.json', category: 'image_to_video' },
  { kind: 'i2v', name: 'Wan2.2图生视频', file: 'wan22-i2v-cartoon-v1.api.json', category: 'image_to_video' },
  { kind: 'edit', name: '千问改图', file: 'qwen-edit-cartoon-v1.api.json', category: 'image_edit' },
];

function formatPrecheckBlock(diff, workflowId) {
  if (!diff.online) return `连不上 ComfyUI：${diff.error || '离线'}。预检工作流 ${workflowId}`;
  const parts = [ `预检拦住：工作流 ${workflowId}` ];
  if (diff.missing_nodes?.length) parts.push(`缺失节点 ${diff.missing_nodes.join('、')}`);
  if (diff.missing_models?.length) {
    parts.push(`缺失模型 ${diff.missing_models.map(item => item.name).join('、')}`);
  }
  if (diff.low_vram) parts.push(`空闲显存 ${diff.vram_free_gb} GB，低于建议 ${diff.suggested_vram_gb} GB`);
  if (diff.version_ok === false && parts.length === 1) parts.push(`版本 ${diff.version || '未知'} 与期望不符`);
  if (parts.length === 1) parts.push(diff.error || '依赖不满足');
  parts.push('到预检工作流页选择来源并梳理目录');
  return parts.join('。');
}

function blockingReason(diff, workflowId) {
  if (!diff) return `预检拦住：工作流 ${workflowId}`;
  const hard = !diff.online
    || diff.version_ok === false
    || (diff.missing_nodes || []).length
    || (diff.missing_models || []).length
    || (!diff.ok && !diff.low_vram);
  if (!hard) return '';
  return formatPrecheckBlock({ ...diff, low_vram: false }, workflowId);
}

const VIDEO_CLASS = /video|wan|vhs_|svd|hunyuan|ltxv|animatediff|mochi|minimax|createvideo|savevideo/i;
const FRAME_KEYS = [ 'length', 'frames', 'num_frames', 'frame_count', 'fps', 'frame_rate' ];

function looksLikeVideo(apiJson) {
  return Object.values(apiJson || {}).some(node => {
    if (!node?.class_type) return false;
    if (VIDEO_CLASS.test(node.class_type)) return true;
    const inputs = node.inputs || {};
    return FRAME_KEYS.some(key => {
      const value = inputs[key];
      return value != null && !Array.isArray(value) && typeof value !== 'object';
    });
  });
}

function mediaOf(row, detail) {
  const category = String(row?.category || detail?.category || '');
  const videoCategory = category === 'text_to_video' || category === 'image_to_video';
  return videoCategory || looksLikeVideo(detail?.api_json) ? 'video' : 'image';
}

const PROMPT_KEYS = [ 'text', 'prompt', 'positive_prompt', 'caption', 'string', 'text_g', 'text_l', 'value', 'negative_prompt' ];

function parseBrief(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return typeof raw === 'object' ? raw : null;
}

function linkedText(graph, field) {
  if (!graph || typeof graph !== 'object') return '';
  const seeds = [];
  Object.values(graph).forEach(node => {
    if (Array.isArray(node?.inputs?.[field])) seeds.push(node.inputs[field]);
  });
  for (const seed of seeds) {
    let currentId = String(seed[0]);
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const node = graph[currentId];
      if (!node) break;
      const key = PROMPT_KEYS.find(item => typeof node.inputs?.[item] === 'string' && String(node.inputs[item]).trim());
      if (key) return node.inputs[key];
      const next = node.inputs?.[field];
      if (!Array.isArray(next)) break;
      currentId = String(next[0]);
    }
  }
  return '';
}

function directPrompt(graph) {
  const preferred = [];
  const rest = [];
  Object.values(graph || {}).forEach(node => {
    const inputs = node?.inputs || {};
    [ 'prompt', 'positive_prompt', 'text', 'caption' ].forEach(key => {
      const value = inputs[key];
      if (typeof value !== 'string' || !value.trim()) return;
      const bucket = /MiniMax|CLIPText|TextEncode|Prompt/i.test(node?.class_type || '') ? preferred : rest;
      bucket.push(value);
    });
  });
  const pool = preferred.length ? preferred : rest;
  return pool.reduce((best, value) => (value.length > best.length ? value : best), '');
}

function directNumber(graph, key) {
  for (const node of Object.values(graph || {})) {
    const value = node?.inputs?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function mentionsInPrompt(text) {
  const found = [];
  const seen = new Set();
  const re = /(人物|角色|场景|道具)「([^」]{1,40})」/g;
  let match;
  while ((match = re.exec(String(text || '')))) {
    const kind = { 人物: 'character', 角色: 'character', 场景: 'scene', 道具: 'prop' }[match[1]];
    const name = match[2].trim();
    const id = `${kind}:${name}`;
    if (!name || seen.has(id)) continue;
    seen.add(id);
    found.push({ id, name, kind });
  }
  return found;
}

function submittedPrompt(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return snapshot;
  const prompt = snapshot.prompt;
  if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) return snapshot;
  const nodes = Object.values(prompt);
  if (nodes.some(node => node && typeof node === 'object' && node.class_type)) return prompt;
  return snapshot;
}

function briefFromSnapshot(snapshot) {
  const graph = submittedPrompt(snapshot);
  return {
    positive: linkedText(graph, 'positive') || directPrompt(graph),
    negative: linkedText(graph, 'negative'),
    seed: directNumber(graph, 'noise_seed') ?? directNumber(graph, 'seed'),
  };
}

function assertReferenceGraph(graph, expected) {
  const node = Object.values(graph || {}).find(item => item?.class_type === 'MiniMaxH3ReferenceToVideo');
  if (!node) {
    const error = new Error('提交给 ComfyUI 的工作流没有参考图入口，RefMod 图片不会被引用');
    error.status = 400;
    throw error;
  }
  const prompt = String(node.inputs?.prompt || '');
  const linked = Object.entries(node.inputs || {}).filter(([ key, value ]) => {
    if (!/^ref_images\.ref_image_\d+$/.test(key) || !Array.isArray(value)) return false;
    const loader = graph[String(value[0])];
    const name = String(loader?.inputs?.image || '').split(/[/\\]/).pop();
    return loader?.class_type === 'LoadImage' && name && name !== 'reference.png';
  }).length;
  const pictures = new Set();
  const re = /<Picture\s+(\d+)\s*>/g;
  let match;
  while ((match = re.exec(prompt))) pictures.add(Number(match[1]));
  const missing = [];
  for (let index = 1; index <= expected; index += 1) {
    if (!pictures.has(index)) missing.push(index);
  }
  if (linked !== expected || missing.length) {
    const error = new Error(`参考图没有完整接进 ComfyUI：工作流接上 ${linked} 张，提示词标了 ${pictures.size} 张，这次要交 ${expected} 张`);
    error.status = 400;
    throw error;
  }
}

function precheckGap(diff, workflowId) {
  return {
    workflow_id: workflowId,
    missing_nodes: diff.missing_nodes || [],
    missing_models: (diff.missing_models || []).map(item => item.name),
    low_vram: Boolean(diff.low_vram),
  };
}

class GenerateService extends Service {
  precheckBase() {
    return this.config.precheck.baseUrl.replace(/\/$/, '');
  }

  comfyBase() {
    return this.config.comfy.baseUrl.replace(/\/$/, '');
  }

  async start(projectId, shotId, payload, kind = 'image') {
    const shot = await this.ctx.model.Shot.findByPk(shotId);
    if (!shot || String(shot.project_id) !== String(projectId)) this.ctx.throw(404, '分镜不存在');
    const claim = begin(this.app, { projectId, kind: 'generate', targetId: shot.id });
    if (claim.joined) return claim.done;
    const stop = {
      signal: claim.signal,
      stopped() { return claim.signal.aborted; },
      release() {},
    };
    try {
    const missingPanel = await this.ctx.service.project.missingPanelLabels(projectId);
    if (missingPanel.length) this.ctx.throw(400, `面板还没填完：${missingPanel.join('、')}`);
    const text = String(payload.positive_zh || '').trim();
    if (!text) this.ctx.throw(400, '需要一句提示词');
    const requestedIds = (Array.isArray(payload.asset_ids) ? payload.asset_ids : [])
      .map(id => Number(id))
      .filter(id => id > 0);
    const videoKind = [ 'video', 'i2v', 't2v', 'refmod' ].includes(kind);
    let storedNegative = '';
    if (videoKind && payload.negative_zh == null) {
      const stored = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
      storedNegative = stored?.negative_zh || '';
    }
    const assetIds = videoKind
      ? await this.ctx.service.refmod.lockCharacterIds(projectId, shot, requestedIds, {
        description: shot.description,
        dialogue: shot.dialogue,
        positive_zh: text,
        negative_zh: payload.negative_zh != null ? payload.negative_zh : storedNegative,
      })
      : requestedIds;
    const picks = this.ctx.service.refmod.normalizePicks(payload.refmod_files)
      ?? await this.ctx.service.refmod.storedPicks(projectId, shot.id);
    const workflowOverride = Number(payload.workflow_id) || 0;
    let workflowName = '';
    if (workflowOverride) {
      const chosen = await this.choiceById(workflowOverride);
      workflowName = chosen.name || '';
      if (videoKind && chosen.media !== 'video') this.ctx.throw(400, '请选择生视频工作流');
      if (!videoKind && chosen.media !== 'image') this.ctx.throw(400, '请选择生图工作流');
    }
    const useRefs = kind === 'refmod' || /\[refmod\]/i.test(workflowName);
    if (kind === 'refmod' && !/\[refmod\]/i.test(workflowName)) {
      this.ctx.throw(400, '请选择一条 [RefMod] 工作流');
    }
    const composed = await this.ctx.service.refmod.composePrompt(
      projectId,
      assetIds,
      text,
      videoKind ? { pictures: true, lock: true, picks } : false,
    );
    if (videoKind && composed.refmodIds.length && !useRefs) {
      this.ctx.throw(400, `工作流「${workflowName || '未选择'}」不能引用 RefMod 图片。这条镜头已经绑了参考图，用这条工作流提交时 ComfyUI 收不到图，成片不会像参考人物。请改用带 [RefMod] 的工作流。`);
    }
    if (useRefs && !composed.refmodIds.length) {
      this.ctx.throw(400, '请勾选已经绑了 RefMod 的角色或场景，并至少留一张参考图');
    }
    const positive = composed.positive;
    const compliance = await complianceCheck(this.ctx, positive);
    const hit = compliance?.hits?.[0];
    if (hit) this.ctx.throw(400, `命中规则 ${hit.id}`);
    const project = await this.ctx.model.Project.findByPk(projectId);
    const caps = project
      ? await this.ctx.model.Rule.findAll({ where: { content_type: project.content_type, kind: 'cost', enabled: true } })
      : [];
    const cap = caps.reduce((min, rule) => {
      const value = Number(rule.cost_cap);
      if (!value) return min;
      return min === null || value < min ? value : min;
    }, null);
    if (cap) {
      const usage = await usageSummary(this.ctx, projectId);
      if (usage && Number(usage.call_count) >= cap) this.ctx.throw(400, '超过成本上限');
    }
    const shotPatch = { positive_zh: text };
    if (payload.negative_zh != null) shotPatch.negative_zh = String(payload.negative_zh);
    if (payload.shot_sizes != null) shotPatch.shot_sizes = payload.shot_sizes;
    if (payload.camera_moves != null) shotPatch.camera_moves = payload.camera_moves;
    else if (payload.camera_move != null) shotPatch.camera_move = payload.camera_move;
    await this.ctx.service.project.updateShot(shot.id, shotPatch);
    const refmodIds = useRefs ? composed.refmodIds : [];
    const taskKind = useRefs ? 'refmod' : kind;
    let durationSec;
    if (videoKind) {
      const seconds = Number(payload.duration_sec);
      if (!Number.isFinite(seconds) || seconds <= 0) this.ctx.throw(400, '请填写视频时长');
      if (seconds > 60) this.ctx.throw(400, '时长不能超过 60 秒');
      durationSec = seconds;
    }
    if (useRefs) await this.assertRefmodWorkflow(workflowOverride);

    const profileRow = project
      ? await this.ctx.model.AgentConfig.findOne({ where: { content_type: project.content_type, role: 'video' } })
      : null;
    const task = await this.ctx.model.Task.create({
      project_id: Number(projectId),
      shot_id: shot.id,
      kind: taskKind,
      status: 'queued',
      model_profile: profileRow?.model_profile || 'comfy-local',
      package_version: project?.package_version || null,
      node_name: '生成',
      operator_name: String(this.ctx.state.user?.username || '').slice(0, 128),
    });
    await reportAudit(this.ctx, {
      action: 'video.generate',
      external_id: task.id,
      detail: { project_id: Number(projectId), shot_id: shot.id, kind },
    });
    const seed = Number(payload.seed);
    if (durationSec) await shot.update({ duration_ms: Math.round(durationSec * 1000) });
    if (stop.stopped()) {
      await task.update({ status: 'cancelled', error_message: '已停止' });
      const cancelled = await task.reload();
      finish(this.app, claim.row, null, cancelled);
      return cancelled;
    }
    return await this.execute(task, positive, Array.isArray(payload.images) ? payload.images : [], {
      refmodIds,
      workflowOverride,
      assetIds,
      seed: Number.isSafeInteger(seed) && seed >= 0 ? seed : undefined,
      durationSec,
      negative: payload.negative_zh != null ? String(payload.negative_zh) : '',
      signal: stop.signal,
      refmodPicks: picks,
    }).then(saved => {
      finish(this.app, claim.row, null, saved);
      return saved;
    });
    } catch (err) {
      finish(this.app, claim.row, err);
      throw err;
    } finally {
      stop.release();
    }
  }

  workflowEnvId(kind) {
    const ids = {
      image: this.config.precheck.t2iWorkflowId,
      video: this.config.precheck.videoWorkflowId,
      i2v: this.config.precheck.i2vWorkflowId,
      edit: this.config.precheck.editWorkflowId,
    };
    const id = Number(ids[kind] || 0);
    return id > 0 ? id : 0;
  }

  async ensureFixtures() {
    if (this.app.cartoonWorkflowIds) return this.app.cartoonWorkflowIds;
    const listUrl = `${this.precheckBase()}/api/workflows`;
    const res = await fetch(listUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`预检返回 ${res.status}`);
    const rows = unwrap(await res.json()) || [];
    const ids = {};
    for (const fixture of FIXTURES) {
      const configured = this.workflowEnvId(fixture.kind);
      if (configured) {
        ids[fixture.kind] = configured;
        continue;
      }
      const existing = rows.find(row => row.name === fixture.name);
      if (existing) {
        ids[fixture.kind] = existing.id;
        continue;
      }
      const apiJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures', fixture.file), 'utf8'));
      const created = await fetch(listUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: fixture.name, category: fixture.category, api_json: apiJson }),
        signal: AbortSignal.timeout(20000),
      });
      if (!created.ok) throw new Error(`导入${fixture.name}失败 ${created.status}`);
      const row = unwrap(await created.json());
      ids[fixture.kind] = row.id;
    }
    this.app.cartoonWorkflowIds = ids;
    return ids;
  }

  async assertRefmodWorkflow(workflowId) {
    const res = await fetch(`${this.precheckBase()}/api/workflows/${workflowId}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`预检返回 ${res.status}`);
    const workflow = unwrap(await res.json());
    if (!String(workflow?.name || '').includes('[RefMod]')) {
      this.ctx.throw(400, '这条工作流不能挂 RefMod 包');
    }
    return workflow;
  }

  async workflowIdFor(kind) {
    const configured = this.workflowEnvId(kind);
    if (configured) return configured;
    const ids = await this.ensureFixtures();
    if (!ids[kind]) this.ctx.throw(400, '没有配置这一类工作流');
    return ids[kind];
  }

  async rerun(taskId) {
    const task = await this.ctx.model.Task.findByPk(taskId);
    if (!task) this.ctx.throw(404, '任务不存在');
    if (![ 'failed', 'cancelled' ].includes(task.status)) {
      this.ctx.throw(400, '只有失败或已取消的任务可以重跑');
    }
    const prompt = task.shot_id
      ? await this.ctx.model.Prompt.findOne({ where: { shot_id: task.shot_id } })
      : null;
    const text = String(prompt?.positive_zh || '').trim();
    if (!text) this.ctx.throw(400, '没有提示词，不能重跑');
    await task.update({ status: 'queued', error_message: '', prompt_id: null });
    const snapshot = task.workflow_snapshot;
    if (snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length) {
      return this.submit(task, snapshot, task.precheck_workflow_id);
    }
    return this.execute(task, text, []);
  }

  async workflowNames() {
    const cached = this.app.cartoonWorkflowNames;
    if (cached && Date.now() - cached.at < 60000) return cached.map;
    const res = await fetch(`${this.precheckBase()}/api/workflows`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`预检返回 ${res.status}`);
    const rows = unwrap(await res.json()) || [];
    const map = new Map(rows.map(row => [ Number(row.id), row.name || '' ]));
    this.app.cartoonWorkflowNames = { at: Date.now(), map };
    return map;
  }

  async choices() {
    const cached = this.app.cartoonWorkflowChoices;
    if (cached && Date.now() - cached.at < 20000) return cached.rows;
    const res = await fetch(`${this.precheckBase()}/api/workflows`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`预检返回 ${res.status}`);
    const rows = unwrap(await res.json()) || [];
    const choices = [];
    const queue = rows.slice();
    const workers = Array.from({ length: Math.min(4, rows.length) }, async () => {
      while (queue.length) {
        const row = queue.shift();
        try {
          const detailRes = await fetch(`${this.precheckBase()}/api/workflows/${row.id}`, { signal: AbortSignal.timeout(20000) });
          if (!detailRes.ok) continue;
          const detail = unwrap(await detailRes.json());
          if (!detail?.call_inputs?.positive) continue;
          choices.push({
            id: row.id,
            name: row.name,
            media: mediaOf(row, detail),
            images: detail.call_inputs.images || [],
          });
        } catch (err) {
          this.ctx.logger.warn('[cartoon] workflow %s %s', row.id, err.message);
        }
      }
    });
    await Promise.all(workers);
    choices.sort((a, b) => a.id - b.id);
    this.app.cartoonWorkflowChoices = { at: Date.now(), rows: choices };
    return choices;
  }

  async choiceById(workflowId) {
    const rows = await this.choices();
    const found = rows.find(item => item.id === Number(workflowId));
    if (!found) this.ctx.throw(400, '工作流不存在，或没有正向提示词');
    return found;
  }

  async inputs() {
    const result = {
      image: { workflow_id: null, images: [] },
      video: { workflow_id: null, images: [] },
      i2v: { workflow_id: null, images: [] },
      edit: { workflow_id: null, images: [] },
      refmod: { workflow_id: null, images: [] },
      workflows: [],
    };
    try {
      result.workflows = await this.choices();
    } catch (err) {
      result.error = err.message;
    }
    for (const kind of [ 'image', 'video', 'i2v', 'edit' ]) {
      try {
        const workflowId = await this.workflowIdFor(kind);
        const found = result.workflows.find(item => item.id === workflowId);
        result[kind] = { workflow_id: workflowId, images: found?.images || [] };
      } catch (err) {
        result[kind] = { workflow_id: null, images: [], error: err.message };
      }
    }
    result.refmod_workflows = result.workflows.filter(item => String(item.name || '').includes('[RefMod]'));
    return result;
  }

  async bindWorkflow(workflowId, positive, images, refImages = [], seed, durationSec, negative) {
    const res = await fetch(`${this.precheckBase()}/api/workflows/${workflowId}/bind`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        positive,
        negative,
        images: images || [],
        ref_images: refImages,
        seed,
        duration_sec: durationSec,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(body.message || `预检返回 ${res.status}`);
      error.status = res.status >= 400 && res.status < 500 ? res.status : 502;
      throw error;
    }
    const data = unwrap(body);
    if (!data?.prompt) throw new Error('预检没有返回可执行的工作流');
    return data.prompt;
  }

  async stopped(task, signal) {
    const fresh = await this.ctx.model.Task.findByPk(task.id);
    if (!fresh) return true;
    if (fresh.status === 'cancelled') return true;
    if (!signal?.aborted) return false;
    if ([ 'success', 'failed' ].includes(fresh.status)) return true;
    await fresh.update({ status: 'cancelled', error_message: '已停止' });
    return true;
  }

  async dropComfyPrompts(promptIds) {
    const ids = [ ...new Set((promptIds || []).filter(Boolean)) ];
    if (!ids.length) return;
    const base = this.comfyBase();
    try {
      await fetch(`${base}/queue`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ delete: ids }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      this.ctx.logger.warn('[cartoon] queue delete %s', err.message);
    }
    const queue = await this.comfyQueue();
    const running = queue?.queue_running || [];
    const hit = ids.some(id => running.some(row => row?.[1] === id));
    if (!hit) return;
    try {
      await fetch(`${base}/interrupt`, { method: 'POST', signal: AbortSignal.timeout(8000) });
    } catch (err) {
      this.ctx.logger.warn('[cartoon] interrupt %s', err.message);
    }
  }

  async stopProject(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    cancelProject(this.app, project.id);
    const tasks = await this.ctx.model.Task.findAll({
      where: {
        project_id: project.id,
        status: [ 'pending', 'queued', 'running', 'saving' ],
      },
    });
    await this.dropComfyPrompts(tasks.map(item => item.prompt_id));
    let stopped = 0;
    for (const task of tasks) {
      const [ count ] = await this.ctx.model.Task.update(
        { status: 'cancelled', error_message: '已停止' },
        { where: { id: task.id, status: [ 'pending', 'queued', 'running', 'saving' ] } },
      );
      stopped += count;
    }
    return { stopped };
  }

  async execute(task, text, images = [], options = {}) {
    if (await this.stopped(task, options.signal)) return task.reload();
    let workflowId;
    let workflowName = '';
    let refImages = [];
    try {
      if (options.workflowOverride) {
        workflowId = options.workflowOverride;
        const chosen = await this.choiceById(workflowId);
        workflowName = chosen.name || '';
        const expectVideo = [ 'video', 'i2v', 't2v', 'refmod' ].includes(task.kind);
        if (expectVideo && chosen.media !== 'video') throw new Error('请选择生视频工作流');
        if (!expectVideo && chosen.media !== 'image') throw new Error('请选择生图工作流');
        if (task.kind === 'refmod') {
          if (!String(chosen.name || '').includes('[RefMod]')) throw new Error('这条工作流不能挂 RefMod 包');
          refImages = await this.ctx.service.refmod.imageFiles(task.project_id, options.refmodIds || [], options.refmodPicks || null);
        }
      } else if (task.kind === 'refmod') {
        throw new Error('请选择一条 [RefMod] 工作流');
      } else {
        workflowId = await this.workflowIdFor(task.kind);
      }
    } catch (err) {
      if (await this.stopped(task, options.signal)) return task.reload();
      await task.update({ status: 'failed', error_message: err.message });
      return task.reload();
    }
    if (await this.stopped(task, options.signal)) return task.reload();
    await this.rememberGeneration(task, workflowId, text, options, workflowName);
    const depUrl = `${this.precheckBase()}/api/workflows/${workflowId}/dependencies`;
    this.ctx.logger.info('[cartoon] precheck GET %s', depUrl);
    let diff;
    try {
      const res = await fetch(depUrl, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`预检返回 ${res.status}`);
      diff = unwrap(await res.json());
    } catch (err) {
      if (await this.stopped(task, options.signal)) return task.reload();
      await task.update({
        status: 'failed',
        error_message: `连不上预检：${err.message}`,
        precheck_workflow_id: workflowId,
      });
      return task.reload();
    }

    if (!diff) {
      await task.update({
        status: 'failed',
        error_message: `连不上预检：依赖检测没有返回`,
        precheck_workflow_id: workflowId,
      });
      return task.reload();
    }

    const reason = blockingReason(diff, workflowId);
    if (reason) {
      await task.update({
        status: 'failed',
        error_message: reason,
        precheck_workflow_id: workflowId,
        precheck_gap: precheckGap(diff, workflowId),
      });
      return task.reload();
    }

    if (await this.stopped(task, options.signal)) return task.reload();
    let graph;
    try {
      graph = await this.bindWorkflow(workflowId, text, images, refImages, options.seed, options.durationSec, options.negative);
      if (refImages.length) assertReferenceGraph(graph, refImages.length);
    } catch (err) {
      if (await this.stopped(task, options.signal)) return task.reload();
      await task.update({ status: 'failed', error_message: err.message, precheck_workflow_id: workflowId });
      return task.reload();
    }
    return this.submit(task, graph, workflowId, options.signal);
  }

  async submit(task, graph, workflowId, signal) {
    if (await this.stopped(task, signal)) return task.reload();
    const promptUrl = `${this.comfyBase()}/prompt`;
    this.ctx.logger.info('[cartoon] comfy POST %s', promptUrl);
    const submission = { prompt: submittedPrompt(graph) || graph, client_id: 'precheck-watch' };
    let submitted;
    try {
      const res = await fetch(promptUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
        signal: AbortSignal.timeout(20000),
      });
      submitted = await res.json();
      if (!res.ok || !submitted.prompt_id) {
        const message = submitted.error?.message || `ComfyUI 返回 ${res.status}`;
        throw new Error(message);
      }
    } catch (err) {
      if (await this.stopped(task, signal)) return task.reload();
      await task.update({
        status: 'failed',
        error_message: `连不上 ComfyUI：${err.message}`,
        workflow_snapshot: submission,
        precheck_workflow_id: workflowId || task.precheck_workflow_id,
      });
      return task.reload();
    }

    if (await this.stopped(task, signal)) {
      await this.dropComfyPrompts([ submitted.prompt_id ]);
      return task.reload();
    }
    await task.update({
      status: 'running',
      prompt_id: submitted.prompt_id,
      workflow_snapshot: submission,
      error_message: '',
      precheck_workflow_id: workflowId || task.precheck_workflow_id,
      precheck_gap: null,
    });
    return task.reload();
  }

  async liveProgress(promptIds) {
    const ids = [ ...new Set((promptIds || []).filter(Boolean)) ];
    if (!ids.length) return {};
    try {
      const res = await fetch(`${this.precheckBase()}/api/comfy/progress?prompt_id=${encodeURIComponent(ids.join(','))}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return {};
      return unwrap(await res.json()) || {};
    } catch (err) {
      this.ctx.logger.warn('[cartoon] progress %s', err.message);
      return {};
    }
  }

  async settleProject(projectId) {
    const tasks = await this.ctx.model.Task.findAll({
      where: { project_id: projectId, status: 'running' },
    });
    if (!tasks.length) return;
    const queue = await this.comfyQueue();
    for (const task of tasks) {
      await this.settleTask(task, queue);
    }
  }

  async comfyQueue() {
    try {
      const res = await fetch(`${this.comfyBase()}/queue`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      this.ctx.logger.warn('[cartoon] queue %s', err.message);
      return null;
    }
  }

  promptPlace(queue, promptId) {
    if (!queue) return 'unknown';
    const running = queue.queue_running || [];
    const pending = queue.queue_pending || [];
    if (running.some(row => row?.[1] === promptId)) return 'running';
    if (pending.some(row => row?.[1] === promptId)) return 'pending';
    return 'gone';
  }

  async settleTask(task, queue) {
    if (!task.prompt_id) return task;
    const historyUrl = `${this.comfyBase()}/history/${task.prompt_id}`;
    let item;
    try {
      const res = await fetch(historyUrl, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return task;
      const history = await res.json();
      item = history[task.prompt_id];
    } catch (err) {
      this.ctx.logger.warn('[cartoon] history %s %s', task.prompt_id, err.message);
      return task;
    }
    if (!item) {
      const place = this.promptPlace(queue, task.prompt_id);
      if (place !== 'gone') return task;
      const started = new Date(task.updatedAt || task.createdAt || 0).getTime();
      if (Number.isFinite(started) && Date.now() - started < 30000) return task;
      await task.update({ status: 'failed', error_message: 'ComfyUI 里已经没有这个任务，生成中断了' });
      return task.reload();
    }
    const statusStr = item.status?.status_str;
    if (statusStr === 'error') {
      await task.update({ status: 'failed', error_message: 'ComfyUI 执行失败' });
      return task.reload();
    }
    if (!item.status?.completed && statusStr !== 'success') return task;

    const [ claimed ] = await this.ctx.model.Task.update(
      { status: 'saving' },
      { where: { id: task.id, status: 'running' } },
    );
    if (!claimed) return task.reload();

    try {
      const files = collectMedia(item.outputs);
      if (!files.length) throw new Error('ComfyUI 没有返回图片');
      for (const file of files) await this.saveOutput(task, file);
      const [ saved ] = await this.ctx.model.Task.update(
        { status: 'success', error_message: '' },
        { where: { id: task.id, status: 'saving' } },
      );
      if (saved && task.shot_id) {
        await this.ctx.model.Shot.update({ upstream_stale: false }, { where: { id: task.shot_id } });
      }
    } catch (err) {
      await task.update({ status: 'failed', error_message: err.message });
    }
    return task.reload();
  }

  async saveOutput(task, file) {
    const filename = path.basename(file.filename || '');
    if (!filename) throw new Error('产物文件名无效');
    const view = new URL('/view', `${this.comfyBase()}/`);
    view.searchParams.set('filename', file.filename);
    view.searchParams.set('subfolder', file.subfolder || '');
    view.searchParams.set('type', file.type || 'output');
    const res = await fetch(view, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`拉取产物失败 ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length) throw new Error('产物是空文件');
    const relative = path.join(String(task.project_id), String(task.id), filename);
    const root = outputRoot(this.app);
    const absolute = path.resolve(root, relative);
    const fromRoot = path.relative(root, absolute);
    if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) throw new Error('产物路径越界');
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    await fs.promises.writeFile(absolute, bytes);
    return this.ctx.model.Output.create({
      task_id: task.id,
      file_path: relative.split(path.sep).join('/'),
      media_kind: file.media_kind || 'image',
      version_stage: 'generated',
    });
  }

  async sendFile(outputId) {
    const output = await this.ctx.model.Output.findByPk(outputId);
    if (!output?.file_path) this.ctx.throw(404, '产物不存在');
    const root = outputRoot(this.app);
    const absolute = resolveInside(root, output.file_path);
    if (!absolute) this.ctx.throw(400, '产物路径无效');
    if (!fs.existsSync(absolute)) this.ctx.throw(404, '产物文件不在磁盘上');
    const stat = fs.statSync(absolute);
    const ext = path.extname(absolute).toLowerCase();
    this.ctx.set('Accept-Ranges', 'bytes');
    this.ctx.type = ext === '.mp4' || ext === '.webm' ? ext.slice(1) : 'png';
    const range = this.ctx.get('range');
    if (!range) {
      this.ctx.set('Content-Length', String(stat.size));
      this.ctx.body = fs.createReadStream(absolute);
      return;
    }
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
    const unsatisfied = () => {
      this.ctx.status = 416;
      this.ctx.set('Content-Range', `bytes */${stat.size}`);
      this.ctx.body = '';
    };
    if (!match || stat.size <= 0) {
      unsatisfied();
      return;
    }
    let start;
    let end;
    if (match[1] === '' && match[2] !== '') {
      const suffix = Number(match[2]);
      start = Math.max(0, stat.size - suffix);
      end = stat.size - 1;
    } else {
      start = match[1] === '' ? 0 : Number(match[1]);
      end = match[2] === '' ? stat.size - 1 : Number(match[2]);
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
      unsatisfied();
      return;
    }
    end = Math.min(end, stat.size - 1);
    this.ctx.status = 206;
    this.ctx.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    this.ctx.set('Content-Length', String(end - start + 1));
    this.ctx.body = fs.createReadStream(absolute, { start, end });
  }

  async removeOutput(outputId) {
    const output = await this.ctx.model.Output.findByPk(outputId);
    if (!output) this.ctx.throw(404, '产物不存在');
    const task = output.task_id ? await this.ctx.model.Task.findByPk(output.task_id) : null;
    if (task && [ 'queued', 'running', 'saving' ].includes(task.status)) {
      this.ctx.throw(400, '正在生成的产物不能删除');
    }
    if (output.file_path) {
      const absolute = resolveInside(outputRoot(this.app), output.file_path);
      if (absolute && fs.existsSync(absolute)) await fs.promises.unlink(absolute);
    }
    const taskId = output.task_id;
    await output.destroy();
    if (taskId) {
      const left = await this.ctx.model.Output.count({ where: { task_id: taskId } });
      if (!left && task && ![ 'queued', 'running', 'saving' ].includes(task.status)) {
        await task.destroy();
      }
    }
    return { id: Number(outputId) };
  }

  async rememberGeneration(task, workflowId, positive, options, workflowName) {
    try {
      const ids = [ ...new Set((options.assetIds || []).map(id => Number(id)).filter(id => id > 0)) ];
      let assets = [];
      if (ids.length) {
        const rows = await this.ctx.model.Asset.findAll({
          where: { project_id: task.project_id, id: ids },
        });
        const byId = new Map(rows.map(row => [ row.id, row ]));
        assets = ids.filter(id => byId.has(id)).map(id => {
          const row = byId.get(id);
          return { id: row.id, name: row.name, kind: row.kind };
        });
      }
      let name = workflowName || '';
      if (!name && workflowId) {
        try {
          const rows = await this.choices();
          name = rows.find(item => item.id === Number(workflowId))?.name || '';
        } catch (err) {
          this.ctx.logger.warn('[cartoon] workflow name %s', err.message);
        }
      }
      await task.update({
        precheck_workflow_id: workflowId || task.precheck_workflow_id,
        generation_brief: {
          workflow_id: workflowId || null,
          workflow_name: name,
          positive: String(positive || ''),
          negative: String(options.negative || ''),
          assets,
          seed: Number.isSafeInteger(options.seed) ? options.seed : null,
          duration_sec: Number(options.durationSec) > 0 ? Number(options.durationSec) : null,
        },
      });
    } catch (err) {
      this.ctx.logger.warn('[cartoon] generation brief %s', err.message);
    }
  }

  presentTask(task) {
    const json = task.toJSON ? task.toJSON() : { ...task };
    const stored = parseBrief(json.generation_brief);
    const extracted = briefFromSnapshot(json.workflow_snapshot);
    const positive = stored?.positive || extracted.positive || '';
    const recorded = Array.isArray(stored?.assets);
    const mentioned = recorded ? [] : mentionsInPrompt(positive);
    const generation = {
      workflow_id: stored?.workflow_id || json.precheck_workflow_id || null,
      workflow_name: stored?.workflow_name || '',
      positive,
      negative: stored?.negative || extracted.negative || '',
      assets: recorded ? stored.assets : mentioned,
      assets_recorded: recorded,
      assets_from_prompt: !recorded && mentioned.length > 0,
      seed: stored?.seed ?? extracted.seed ?? null,
      duration_sec: stored?.duration_sec ?? null,
    };
    const hasWorkflow = Boolean(json.workflow_snapshot && typeof json.workflow_snapshot === 'object' && Object.keys(json.workflow_snapshot).length);
    delete json.workflow_snapshot;
    delete json.generation_brief;
    return { ...json, generation, has_workflow: hasWorkflow };
  }

  async workflowOf(taskId) {
    const task = await this.ctx.model.Task.findByPk(taskId);
    if (!task) this.ctx.throw(404, '产物不存在');
    return {
      id: task.id,
      submitted: task.workflow_snapshot || null,
    };
  }

  async removeTask(taskId) {
    const task = await this.ctx.model.Task.findByPk(taskId);
    if (!task) this.ctx.throw(404, '产物不存在');
    if ([ 'queued', 'running', 'saving' ].includes(task.status)) {
      this.ctx.throw(400, '正在生成的产物不能删除');
    }
    const outputs = await this.ctx.model.Output.findAll({ where: { task_id: task.id } });
    for (const output of outputs) {
      if (output.file_path) {
        const absolute = resolveInside(outputRoot(this.app), output.file_path);
        if (absolute && fs.existsSync(absolute)) await fs.promises.unlink(absolute);
      }
      await output.destroy();
    }
    await task.destroy();
    return { id: Number(taskId) };
  }
}

module.exports = GenerateService;
