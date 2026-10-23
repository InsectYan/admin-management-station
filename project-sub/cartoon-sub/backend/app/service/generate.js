'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');
const { reportAudit } = require('../lib/reportAudit');
const { complianceCheck } = require('../lib/complianceCheck');
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
    if (!await this.ctx.service.project.panelReady(projectId)) this.ctx.throw(400, '面板还没填完');
    const text = String(payload.positive_zh || '').trim();
    if (!text) this.ctx.throw(400, '需要一句提示词');
    const compliance = await complianceCheck(this.ctx, text);
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
    await this.ctx.service.project.updateShot(shot.id, { positive_zh: text });

    const task = await this.ctx.model.Task.create({
      project_id: Number(projectId),
      shot_id: shot.id,
      kind,
      status: 'queued',
    });
    await reportAudit(this.ctx, {
      action: 'video.generate',
      external_id: task.id,
      detail: { project_id: Number(projectId), shot_id: shot.id, kind },
    });
    return this.execute(task, text, Array.isArray(payload.images) ? payload.images : []);
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

  async inputs() {
    const kinds = [ 'image', 'video', 'i2v', 'edit' ];
    const result = {};
    for (const kind of kinds) {
      try {
        const workflowId = await this.workflowIdFor(kind);
        const res = await fetch(`${this.precheckBase()}/api/workflows/${workflowId}`, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`预检返回 ${res.status}`);
        const workflow = unwrap(await res.json());
        result[kind] = { workflow_id: workflowId, images: workflow.call_inputs?.images || [] };
      } catch (err) {
        result[kind] = { workflow_id: null, images: [], error: err.message };
      }
    }
    return result;
  }

  async bindWorkflow(workflowId, positive, images) {
    const res = await fetch(`${this.precheckBase()}/api/workflows/${workflowId}/bind`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ positive, images: images || [] }),
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

  async execute(task, text, images = []) {
    let workflowId;
    try {
      workflowId = await this.workflowIdFor(task.kind);
    } catch (err) {
      await task.update({ status: 'failed', error_message: err.message });
      return task.reload();
    }
    const depUrl = `${this.precheckBase()}/api/workflows/${workflowId}/dependencies`;
    this.ctx.logger.info('[cartoon] precheck GET %s', depUrl);
    let diff;
    try {
      const res = await fetch(depUrl, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`预检返回 ${res.status}`);
      diff = unwrap(await res.json());
    } catch (err) {
      await task.update({
        status: 'failed',
        error_message: `连不上预检：${err.message}`,
        precheck_workflow_id: workflowId,
      });
      return task.reload();
    }

    if (!diff.ok) {
      await task.update({
        status: 'failed',
        error_message: formatPrecheckBlock(diff, workflowId),
        precheck_workflow_id: workflowId,
        precheck_gap: precheckGap(diff, workflowId),
      });
      return task.reload();
    }

    let graph;
    try {
      graph = await this.bindWorkflow(workflowId, text, images);
    } catch (err) {
      await task.update({ status: 'failed', error_message: err.message, precheck_workflow_id: workflowId });
      return task.reload();
    }
    return this.submit(task, graph, workflowId);
  }

  async submit(task, graph, workflowId) {
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
        precheck_workflow_id: workflowId || task.precheck_workflow_id,
      });
      return task.reload();
    }

    await task.update({
      status: 'running',
      prompt_id: submitted.prompt_id,
      workflow_snapshot: graph,
      error_message: '',
      precheck_workflow_id: workflowId || task.precheck_workflow_id,
      precheck_gap: null,
    });
    return task.reload();
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
      if (task.shot_id) {
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
}

module.exports = GenerateService;
