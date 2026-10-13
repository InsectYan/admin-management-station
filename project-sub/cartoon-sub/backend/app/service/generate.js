'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;

function unwrap(json) {
  if (json && Object.prototype.hasOwnProperty.call(json, 'data')) return json.data;
  return json;
}

function linkedNode(graph, link) {
  const id = Array.isArray(link) ? link[0] : null;
  return id == null ? null : graph[String(id)];
}

function applyPositivePrompt(apiJson, text) {
  const graph = JSON.parse(JSON.stringify(apiJson));
  const wan = Object.values(graph).find(node => node && node.class_type === 'WanFirstLastFrameToVideo');
  const sampler = Object.values(graph).find(node => node && node.class_type === 'KSampler');
  const seeds = [ wan?.inputs?.positive, sampler?.inputs?.positive ].filter(Boolean);
  let positive = null;
  for (const link of seeds) {
    let node = linkedNode(graph, link);
    const seen = new Set();
    while (node && !seen.has(node)) {
      seen.add(node);
      if (node.class_type === 'CLIPTextEncode') {
        positive = node;
        break;
      }
      node = linkedNode(graph, node.inputs?.positive);
    }
    if (positive) break;
  }
  if (!positive) {
    const error = new Error('工作流里没有正向 CLIPTextEncode');
    error.status = 400;
    throw error;
  }
  positive.inputs.text = text;
  return graph;
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

function outputRoot(app) {
  return path.resolve(app.baseDir, '../data/outputs');
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
    const text = String(payload.positive_zh || '').trim();
    if (!text) this.ctx.throw(400, '需要一句提示词');
    await this.ctx.service.project.updateShot(shot.id, { positive_zh: text });

    const workflowId = kind === 'video'
      ? this.config.precheck.videoWorkflowId
      : this.config.precheck.t2iWorkflowId;
    if (!workflowId) this.ctx.throw(400, '没有配置这一类工作流');
    const task = await this.ctx.model.Task.create({
      project_id: Number(projectId),
      shot_id: shot.id,
      kind,
      status: 'queued',
    });
    const depUrl = `${this.precheckBase()}/api/workflows/${workflowId}/dependencies`;
    this.ctx.logger.info('[cartoon] precheck GET %s', depUrl);
    let diff;
    try {
      const res = await fetch(depUrl, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`预检返回 ${res.status}`);
      diff = unwrap(await res.json());
    } catch (err) {
      await task.update({ status: 'failed', error_message: `连不上预检：${err.message}` });
      return task.reload();
    }

    if (!diff.ok) {
      await task.update({ status: 'failed', error_message: this.blockReason(diff) });
      return task.reload();
    }

    let graph;
    try {
      const showUrl = `${this.precheckBase()}/api/workflows/${workflowId}`;
      const res = await fetch(showUrl, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`预检返回 ${res.status}`);
      const workflow = unwrap(await res.json());
      graph = applyPositivePrompt(workflow.api_json, text);
    } catch (err) {
      await task.update({ status: 'failed', error_message: err.message });
      return task.reload();
    }

    const promptUrl = `${this.comfyBase()}/prompt`;
    this.ctx.logger.info('[cartoon] comfy POST %s', promptUrl);
    let submitted;
    try {
      const res = await fetch(promptUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: graph, client_id: `cartoon-${task.id}` }),
        signal: AbortSignal.timeout(20000),
      });
      submitted = await res.json();
      if (!res.ok || !submitted.prompt_id) {
        const message = submitted.error?.message || `ComfyUI 返回 ${res.status}`;
        throw new Error(message);
      }
    } catch (err) {
      await task.update({
        status: 'failed',
        error_message: `连不上 ComfyUI：${err.message}`,
        workflow_snapshot: graph,
      });
      return task.reload();
    }

    await task.update({
      status: 'running',
      prompt_id: submitted.prompt_id,
      workflow_snapshot: graph,
      error_message: '',
    });
    return task.reload();
  }

  blockReason(diff) {
    if (!diff.online) return `连不上 ComfyUI：${diff.error || '离线'}`;
    if (diff.missing_nodes?.length) return `预检拦住：缺失节点 ${diff.missing_nodes.join('、')}`;
    if (diff.missing_models?.length) {
      return `预检拦住：缺失模型 ${diff.missing_models.map(item => item.name).join('、')}`;
    }
    if (diff.low_vram) return `预检拦住：空闲显存 ${diff.vram_free_gb} GB，低于建议 ${diff.suggested_vram_gb} GB`;
    if (diff.version_ok === false) return `预检拦住：版本 ${diff.version || '未知'} 与期望不符`;
    return `预检拦住：${diff.error || '依赖不满足'}`;
  }

  async settleProject(projectId) {
    const tasks = await this.ctx.model.Task.findAll({
      where: { project_id: projectId, status: 'running' },
    });
    for (const task of tasks) {
      await this.settleTask(task);
    }
  }

  async settleTask(task) {
    if (!task.prompt_id) return task;
    const historyUrl = `${this.comfyBase()}/history/${task.prompt_id}`;
    let item;
    try {
      const res = await fetch(historyUrl, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return task;
      const history = await res.json();
      item = history[task.prompt_id];
    } catch (err) {
      this.ctx.logger.warn('[cartoon] history %s %s', task.prompt_id, err.message);
      return task;
    }
    if (!item) return task;
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
      await task.update({ status: 'success', error_message: '' });
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
    });
  }

  async sendFile(outputId) {
    const output = await this.ctx.model.Output.findByPk(outputId);
    if (!output?.file_path) this.ctx.throw(404, '产物不存在');
    const root = outputRoot(this.app);
    const absolute = path.resolve(root, output.file_path);
    const fromRoot = path.relative(root, absolute);
    if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) this.ctx.throw(400, '产物路径无效');
    if (!fs.existsSync(absolute)) this.ctx.throw(404, '产物文件不在磁盘上');
    const ext = path.extname(absolute).toLowerCase();
    this.ctx.type = ext === '.mp4' || ext === '.webm' ? ext.slice(1) : 'png';
    this.ctx.body = fs.createReadStream(absolute);
  }
}

module.exports = GenerateService;
