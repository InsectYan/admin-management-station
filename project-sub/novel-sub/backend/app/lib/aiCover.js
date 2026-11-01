'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const COVER_SPEC = {
  width: 768,
  height: 1024,
  ratio: '3:4',
};

const IMAGE_CATEGORIES = new Set([ 'text_to_image', 'image_edit', 'other' ]);
const VIDEO_CLASS = /video|wan|vhs_|svd|hunyuan|ltxv|animatediff|mochi|minimax/i;
const FRAME_KEYS = [ 'length', 'frames', 'num_frames', 'frame_count', 'fps', 'frame_rate' ];
const LIST_TTL_MS = 20000;
const POLL_MS = 2000;
const POLL_BUDGET_MS = 15 * 60 * 1000;

let listCache = { at: 0, payload: null };

function fail(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function unwrap(json) {
  if (json && Object.prototype.hasOwnProperty.call(json, 'data')) return json.data;
  return json;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildCoverPrompt(body) {
  const custom = String(body.prompt || '').trim();
  if (custom) return custom;
  const title = String(body.title || '').trim();
  const intent = String(body.creative_intent || body.summary || '').trim();
  const overview = String(body.story_overview || '').trim().slice(0, 280);
  if (!title) {
    throw fail(400, 'COVER_CONTEXT_REQUIRED', '请先填写书名，或提供自定义提示词');
  }
  return [
    '竖版小说封面插画，电影级光影，无文字、无水印、无字母、无标题。',
    `书名意象：${title}。`,
    intent ? `故事气质：${intent}` : '',
    overview ? `情节氛围（摘自概要）：${overview}` : '',
    `构图适合书店陈列，画面比例 ${COVER_SPEC.ratio}，留出上方书名区，风格统一。`,
  ].filter(Boolean).join('');
}

function publicBase(ctx) {
  const fromEnv = (process.env.NOVEL_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const port = process.env.NOVEL_PORT || process.env.PORT || 5201;
  return `http://127.0.0.1:${port}`;
}

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

function readOutputSize(apiJson) {
  const found = [];
  Object.values(apiJson || {}).forEach(node => {
    const inputs = node?.inputs || {};
    if (Array.isArray(inputs.width) || Array.isArray(inputs.height)) return;
    const width = Number(inputs.width);
    const height = Number(inputs.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 64 || height < 64) return;
    found.push({
      width,
      height,
      latent: /latent/i.test(node.class_type || ''),
    });
  });
  const picked = found.find(item => item.latent) || found[0];
  if (!picked) return null;
  return { width: picked.width, height: picked.height };
}

function blockReason(diff) {
  if (!diff?.online) return `连不上 ComfyUI：${diff?.error || '离线'}`;
  const parts = [];
  if (diff.missing_nodes?.length) parts.push(`缺失节点 ${diff.missing_nodes.join('、')}`);
  if (diff.missing_models?.length) {
    parts.push(`缺失模型 ${diff.missing_models.map(item => item.name || item).join('、')}`);
  }
  if (diff.version_ok === false) parts.push(`版本 ${diff.version || '未知'} 与期望不符`);
  if (!parts.length && diff.low_vram) return '';
  if (!parts.length) parts.push(diff.error || '依赖不满足');
  return parts.join('。');
}

function vramNote(diff) {
  if (!diff?.low_vram) return '';
  return `空闲显存 ${diff.vram_free_gb} GB，低于建议 ${diff.suggested_vram_gb} GB`;
}

function precheckBase(ctx) {
  return String(ctx.app.config.precheck.baseUrl || '').replace(/\/$/, '');
}

function comfyBase(ctx) {
  return String(ctx.app.config.comfy.baseUrl || '').replace(/\/$/, '');
}

async function precheckJson(ctx, apiPath, options = {}) {
  const url = `${precheckBase(ctx)}${apiPath}`;
  let res;
  try {
    res = await fetch(url, {
      method: options.method || 'GET',
      headers: { 'content-type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeout || 30000),
    });
  } catch (err) {
    throw fail(502, 'PRECHECK_UNREACHABLE', `连不上预检：${err.message}`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw fail(status, 'PRECHECK_ERROR', body.message || `预检返回 ${res.status}`);
  }
  return unwrap(body);
}

async function mapPool(items, limit, worker) {
  const queue = items.slice();
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function workflowCard(row, size) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    width: size?.width || null,
    height: size?.height || null,
  };
}

async function loadCoverWorkflows(ctx) {
  const rows = await precheckJson(ctx, '/api/workflows') || [];
  const candidates = rows.filter(row => IMAGE_CATEGORIES.has(row.category));
  const workflows = [];
  const blocked = [];
  await mapPool(candidates, 2, async row => {
    let detail;
    try {
      detail = await precheckJson(ctx, `/api/workflows/${row.id}`);
    } catch (err) {
      blocked.push({ id: row.id, name: row.name, reason: err.message });
      return;
    }
    const graph = detail.api_json || {};
    if (looksLikeVideo(graph)) return;
    const images = detail.call_inputs?.images || [];
    if (images.length) {
      blocked.push({ id: row.id, name: row.name, reason: '需要输入图片，封面请改用文生图工作流' });
      return;
    }
    if (!detail.call_inputs?.positive) {
      blocked.push({ id: row.id, name: row.name, reason: '工作流里没有正向提示词' });
      return;
    }
    const size = readOutputSize(graph);
    let diff;
    try {
      diff = await precheckJson(ctx, `/api/workflows/${row.id}/dependencies`);
    } catch (err) {
      blocked.push({ ...workflowCard(row, size), reason: err.message });
      return;
    }
    const card = workflowCard(row, size);
    const reason = diff.ok ? '' : blockReason(diff);
    if (!reason) workflows.push({ ...card, warning: vramNote(diff) });
    else blocked.push({ ...card, reason });
  });
  workflows.sort((a, b) => a.id - b.id);
  return { spec: COVER_SPEC, workflows, blocked };
}

async function listCoverWorkflows(ctx, options = {}) {
  const now = Date.now();
  if (!options.refresh && listCache.payload && now - listCache.at < LIST_TTL_MS) {
    return listCache.payload;
  }
  const payload = await loadCoverWorkflows(ctx);
  listCache = { at: Date.now(), payload };
  return payload;
}

function comfyMessage(body, status) {
  const error = body?.error;
  if (!error) return `ComfyUI 返回 ${status}`;
  if (typeof error === 'string') return error;
  const nodeErrors = error.node_errors ? JSON.stringify(error.node_errors) : '';
  return [ error.message || error.type || '', nodeErrors ].filter(Boolean).join(' ') || `ComfyUI 返回 ${status}`;
}

function collectImages(outputs) {
  const files = [];
  Object.values(outputs || {}).forEach(entry => {
    (entry?.images || []).forEach(file => {
      if (/\.(mp4|webm|mkv|gif)$/i.test(file.filename || '')) return;
      files.push(file);
    });
  });
  return files;
}

async function submitGraph(ctx, graph) {
  const url = `${comfyBase(ctx)}/prompt`;
  let res;
  let body;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: graph, client_id: 'precheck-watch' }),
      signal: AbortSignal.timeout(20000),
    });
    body = await res.json().catch(() => ({}));
  } catch (err) {
    throw fail(502, 'COMFY_UNREACHABLE', `连不上 ComfyUI：${err.message}`);
  }
  if (!res.ok || !body.prompt_id) {
    throw fail(502, 'COMFY_REJECTED', `连不上 ComfyUI：${comfyMessage(body, res.status)}`);
  }
  return body.prompt_id;
}

function coverJobs(ctx) {
  if (!ctx.app.coverJobs) ctx.app.coverJobs = new Map();
  return ctx.app.coverJobs;
}

function touchCoverJob(ctx, jobId, patch) {
  if (!/^[\w-]{4,40}$/.test(jobId || '')) return;
  const current = coverJobs(ctx).get(jobId) || { status: 'running', progress_percent: 0 };
  coverJobs(ctx).set(jobId, { ...current, ...patch, updated_at: Date.now() });
}

function readCoverJob(ctx, jobId) {
  if (!/^[\w-]{4,40}$/.test(jobId || '')) return { status: 'idle', progress_percent: 0 };
  return coverJobs(ctx).get(jobId) || { status: 'idle', progress_percent: 0 };
}

async function pullCoverProgress(ctx, promptId) {
  try {
    const data = await precheckJson(ctx, `/api/comfy/progress?prompt_id=${encodeURIComponent(promptId)}`);
    return data?.[promptId] || null;
  } catch (err) {
    ctx.logger.warn('[novel] cover progress %s', err.message);
    return null;
  }
}

async function waitForImage(ctx, promptId, jobId) {
  const base = comfyBase(ctx);
  const started = Date.now();
  while (Date.now() - started < POLL_BUDGET_MS) {
    await sleep(POLL_MS);
    const live = await pullCoverProgress(ctx, promptId);
    if (live) {
      touchCoverJob(ctx, jobId, {
        status: 'running',
        phase: live.phase,
        progress_percent: live.progress_percent || 0,
        progress_value: live.progress_value || 0,
        progress_max: live.progress_max || 0,
        queue_ahead: live.queue_ahead || 0,
        node: live.node || '',
      });
      if (live.phase === 'error') {
        throw fail(502, 'COMFY_FAILED', live.error || 'ComfyUI 执行失败');
      }
    }
    let item;
    try {
      const res = await fetch(`${base}/history/${promptId}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const history = await res.json();
      item = history[promptId];
    } catch (err) {
      ctx.logger.warn('[novel] cover history %s %s', promptId, err.message);
      continue;
    }
    if (!item) continue;
    if (item.status?.status_str === 'error') {
      throw fail(502, 'COMFY_FAILED', 'ComfyUI 执行失败');
    }
    if (!item.status?.completed && item.status?.status_str !== 'success') continue;
    const files = collectImages(item.outputs);
    if (!files.length) {
      throw fail(502, 'COVER_NOT_IMAGE', '这份工作流没有产出图片。封面请改用文生图工作流');
    }
    return files[files.length - 1];
  }
  throw fail(504, 'COVER_TIMEOUT', '封面生成超时。工作流可能仍在 ComfyUI 队列中，请稍后再试');
}

async function downloadView(ctx, file) {
  const view = new URL('/view', `${comfyBase(ctx)}/`);
  view.searchParams.set('filename', file.filename);
  view.searchParams.set('subfolder', file.subfolder || '');
  view.searchParams.set('type', file.type || 'output');
  let res;
  try {
    res = await fetch(view, { signal: AbortSignal.timeout(120000) });
  } catch (err) {
    throw fail(502, 'COVER_DOWNLOAD_FAILED', `下载生成图片失败：${err.message}`);
  }
  if (!res.ok) throw fail(502, 'COVER_DOWNLOAD_FAILED', '下载生成图片失败');
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw fail(502, 'MEDIA_EMPTY', '未拿到图片数据');
  return buf;
}

async function persistBuffer(ctx, buf, filename) {
  const dir = path.join(ctx.app.baseDir, 'app/public/covers');
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(filename || '').toLowerCase();
  const safeExt = [ '.png', '.jpg', '.jpeg', '.webp' ].includes(ext) ? ext : '.png';
  const name = `cover-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`;
  await fs.writeFile(path.join(dir, name), buf);
  return `${publicBase(ctx)}/public/covers/${name}`;
}

async function generateCover(ctx, body) {
  const jobId = String(body?.job_id || '').trim();
  touchCoverJob(ctx, jobId, {
    status: 'running',
    phase: 'queued',
    progress_percent: 0,
    progress_value: 0,
    progress_max: 0,
    queue_ahead: 0,
    node: '',
  });
  const prompt = buildCoverPrompt(body || {});
  const workflowId = Number(body.workflow_id);
  if (!workflowId) {
    throw fail(400, 'COVER_WORKFLOW_REQUIRED', '请选择一个可用的文生图工作流');
  }
  const detail = await precheckJson(ctx, `/api/workflows/${workflowId}`);
  const graphSource = detail.api_json || {};
  if (looksLikeVideo(graphSource) || (detail.call_inputs?.images || []).length) {
    throw fail(400, 'COVER_WORKFLOW_UNSUPPORTED', '这份工作流需要输入图片或会产出视频。封面请改用文生图工作流');
  }
  const diff = await precheckJson(ctx, `/api/workflows/${workflowId}/dependencies`);
  const reason = diff.ok ? '' : blockReason(diff);
  if (reason) {
    throw fail(400, 'COVER_WORKFLOW_UNAVAILABLE', reason);
  }
  const bound = await precheckJson(ctx, `/api/workflows/${workflowId}/bind`, {
    method: 'POST',
    body: { positive: prompt, seed: body.seed },
    timeout: 60000,
  });
  if (!bound?.prompt) {
    throw fail(502, 'PRECHECK_ERROR', '预检没有返回可执行的工作流');
  }
  let promptId;
  try {
    await precheckJson(ctx, '/api/comfy/progress').catch(() => {});
    promptId = await submitGraph(ctx, bound.prompt);
    touchCoverJob(ctx, jobId, { prompt_id: promptId, phase: 'queued' });
    const file = await waitForImage(ctx, promptId, jobId);
    const buf = await downloadView(ctx, file);
    const coverUrl = await persistBuffer(ctx, buf, file.filename);
    const size = readOutputSize(bound.prompt) || readOutputSize(graphSource);
    touchCoverJob(ctx, jobId, { status: 'success', phase: 'success', progress_percent: 100 });
    return {
      cover_url: coverUrl,
      workflow_id: workflowId,
      workflow_name: detail.name || '',
      prompt,
      spec: COVER_SPEC,
      output_width: size?.width || null,
      output_height: size?.height || null,
    };
  } catch (err) {
    touchCoverJob(ctx, jobId, { status: 'failed', phase: 'error', error: err.message });
    throw err;
  }
}

module.exports = {
  COVER_SPEC,
  generateCover,
  readCoverJob,
  buildCoverPrompt,
  listCoverWorkflows,
  readOutputSize,
  looksLikeVideo,
};
