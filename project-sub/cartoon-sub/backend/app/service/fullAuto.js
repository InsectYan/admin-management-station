'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { invokeSkill } = require('../lib/agentProxy');
const { cancelProject } = require('../lib/activeRuns');
const { outputRoot, resolveInside } = require('../lib/mediaPaths');
const { ownPassage, sceneIsSparse, polishSheetPrompt } = require('../lib/assetExcerpt');

const NODE_KEYS = [ 'script', 'assets', 'storyboard', 'prompts', 'workflow', 'video' ];
const NODE_LABEL = {
  script: '正在生成剧本',
  assets: '正在生成资产',
  storyboard: '正在拆分分镜',
  prompts: '正在生成提示词',
  workflow: '正在确认工作流',
  video: '正在生成镜头',
};
const VIDEO_KINDS = [ 'video', 'i2v', 't2v', 'refmod' ];
const WAIT_LIMIT_MS = 40 * 60 * 1000;

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error('已停止');
      err.stop = true;
      reject(err);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      const err = new Error('已停止');
      err.stop = true;
      reject(err);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isStop(err) {
  const message = String(err?.message || '');
  return Boolean(err?.stop) || err?.status === 499 || message === '已停止' || message.includes('已停止');
}

function rollSeed() {
  const digits = 8 + Math.floor(Math.random() * 3);
  const min = 10 ** (digits - 1);
  return min + Math.floor(Math.random() * (10 ** digits - min));
}

function parseJson(raw, fallback) {
  try {
    const data = JSON.parse(raw || '');
    return data == null ? fallback : data;
  } catch {
    return fallback;
  }
}

function sheetPrompt(result) {
  const output = result?.output || {};
  return String(output.prompt || output.state?.prompt || '').trim();
}

function imageSize(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 64 || h < 64 || w > 2048 || h > 2048 || w % 32 || h % 32) {
    const err = new Error('图片宽高需要是 64 到 2048 之间的 32 倍数');
    err.status = 400;
    throw err;
  }
  return { width: w, height: h };
}

function assetText(item) {
  if (item.kind === 'scene') return String(item.look || '').trim().slice(0, 4000);
  const look = String(item.look || '').trim();
  const note = String(item.note || '').trim();
  if (!note || look.includes(note)) return look.slice(0, 4000);
  return [ look, note ].filter(Boolean).join('\n').slice(0, 4000);
}

function sceneBrief(script, name, note) {
  const parts = [];
  const extra = String(note || '').trim();
  if (extra) parts.push(extra);
  const seen = new Set();
  (Array.isArray(script?.scenes) ? script.scenes : []).forEach(scene => {
    const title = String(scene?.title || scene?.name || '').trim();
    const summary = String(scene?.summary || '').trim();
    if (title !== name || !summary || seen.has(summary)) return;
    seen.add(summary);
    parts.push(summary);
  });
  return parts.join('\n').slice(0, 4000);
}

function blankNodes() {
  return Object.fromEntries(NODE_KEYS.map(key => [ key, { status: 'pending', note: '' } ]));
}

function sceneTitle(script, shot) {
  const stored = String(shot?.scene_label || '').trim();
  if (stored) return stored;
  const text = String(shot?.description || '');
  const names = [];
  (Array.isArray(script?.places) ? script.places : []).forEach(item => {
    const name = String(item?.name || '').trim();
    if (name) names.push(name);
  });
  (Array.isArray(script?.scenes) ? script.scenes : []).forEach(scene => {
    const name = String(scene?.title || scene?.name || '').trim();
    if (name) names.push(name);
  });
  names.sort((a, b) => b.length - a.length);
  return names.find(name => text.includes(name)) || '';
}

class FullAutoService extends Service {
  signals() {
    if (!this.app.fullAutoSignals) this.app.fullAutoSignals = new Map();
    return this.app.fullAutoSignals;
  }

  walking() {
    if (!this.app.fullAutoWalking) this.app.fullAutoWalking = new Set();
    return this.app.fullAutoWalking;
  }

  signal(runId) {
    const map = this.signals();
    const key = Number(runId);
    if (!map.has(key)) map.set(key, new AbortController());
    return map.get(key).signal;
  }

  abort(runId) {
    const map = this.signals();
    const key = Number(runId);
    const controller = map.get(key);
    if (controller) controller.abort();
    map.delete(key);
  }

  summary(run) {
    return {
      id: run.id,
      project_id: run.project_id,
      import_id: run.import_id,
      chapter_title: run.chapter_title || '',
      status: run.status,
      current_node: run.current_node,
      message: run.message || '',
      error_message: run.error_message || '',
      asset_workflow_id: run.asset_workflow_id,
      frame_workflow_id: run.frame_workflow_id,
      video_workflow_id: run.video_workflow_id,
      asset_workflow_name: run.asset_workflow_name || '',
      frame_workflow_name: run.frame_workflow_name || '',
      video_workflow_name: run.video_workflow_name || '',
      video_done: run.video_done || 0,
      video_total: run.video_total || 0,
      nodes: parseJson(run.nodes, {}),
      created_at: run.created_at,
      updated_at: run.updated_at,
    };
  }

  detail(run) {
    return {
      ...this.summary(run),
      log: parseJson(run.log, []),
    };
  }

  async list(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const rows = await this.ctx.model.FullRun.findAll({
      where: { project_id: project.id },
      order: [[ 'id', 'DESC' ]],
    });
    return rows.map(row => this.summary(row));
  }

  async active(projectId) {
    const row = await this.ctx.model.FullRun.findOne({
      where: { project_id: projectId, status: 'running' },
      order: [[ 'id', 'DESC' ]],
    });
    return row ? this.summary(row) : null;
  }

  async show(projectId, runId) {
    const row = await this.ctx.model.FullRun.findOne({
      where: { id: runId, project_id: projectId },
    });
    if (!row) this.ctx.throw(404, '这条流程不存在');
    return this.detail(row);
  }

  async imageChoice(workflowId, options = {}) {
    const chosen = await this.ctx.service.generate.choiceById(workflowId);
    if (chosen.media !== 'image') this.ctx.throw(400, `「${chosen.name}」不是生图工作流`);
    if (/反推|改图/.test(chosen.name || '')) this.ctx.throw(400, `「${chosen.name}」不能用来出设定图或首尾帧`);
    if (!options.allowReference && /图生图/.test(chosen.name || '')) {
      this.ctx.throw(400, `「${chosen.name}」是图生图，人物和场景设定图请用文生图`);
    }
    return chosen;
  }

  async start(projectId, payload) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const chapter = await this.ctx.model.Import.findOne({
      where: { id: payload.import_id, project_id: project.id },
    });
    if (!chapter || chapter.deleted_at) this.ctx.throw(404, '章节快照不存在');
    const running = await this.ctx.model.FullRun.findOne({
      where: { project_id: project.id, status: 'running' },
    });
    if (running) this.ctx.throw(409, '已有全流程在执行');
    const assetWorkflow = await this.imageChoice(payload.asset_workflow_id);
    const frameWorkflow = await this.imageChoice(payload.frame_workflow_id, { allowReference: true });
    const assetSize = imageSize(payload.asset_width, payload.asset_height);
    const frameSize = imageSize(payload.frame_width, payload.frame_height);
    const workflows = await this.ctx.service.generate.choices();
    const videoWorkflow = workflows.find(entry => entry.media === 'video'
      && /满血-h3-首尾帧/i.test(entry.name)
      && /\[refmod\]/i.test(entry.name));
    if (!videoWorkflow) this.ctx.throw(400, '没有找到满血 H3 首尾帧 RefMod 工作流');
    const endSlot = (videoWorkflow.images || []).find(slot => slot.role === 'end');
    if (!endSlot) this.ctx.throw(400, '满血首尾帧工作流没有尾帧入口');
    const run = await this.ctx.model.FullRun.create({
      project_id: project.id,
      import_id: chapter.id,
      chapter_title: chapter.chapter_title || '未命名章节',
      status: 'running',
      current_node: 'script',
      message: NODE_LABEL.script,
      nodes: JSON.stringify(blankNodes()),
      log: '[]',
      asset_workflow_id: assetWorkflow.id,
      frame_workflow_id: frameWorkflow.id,
      video_workflow_id: videoWorkflow.id,
      asset_workflow_name: assetWorkflow.name || '',
      frame_workflow_name: frameWorkflow.name || '',
      video_workflow_name: videoWorkflow.name || '',
      asset_width: assetSize.width,
      asset_height: assetSize.height,
      frame_width: frameSize.width,
      frame_height: frameSize.height,
      fresh: Boolean(payload.fresh),
      scope: 'all',
    });
    const runId = run.id;
    setImmediate(() => {
      this.app.createAnonymousContext().service.fullAuto.walk(runId)
        .catch(err => this.app.logger.error('[cartoon] 全流程中断 %s', err));
    });
    return this.summary(run);
  }

  async startAssets(projectId, payload) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const chapter = await this.ctx.model.Import.findOne({
      where: { id: payload.import_id, project_id: project.id },
    });
    if (!chapter || chapter.deleted_at) this.ctx.throw(404, '章节快照不存在');
    const script = chapter.script_data || {};
    const hasScript = (Array.isArray(script.scenes) && script.scenes.length)
      || (Array.isArray(script.characters) && script.characters.length);
    if (!hasScript) this.ctx.throw(400, '还没有剧本');
    if (!this.sheetPlan(chapter).length) this.ctx.throw(400, '剧本里没有可生成的人物或场景');
    const running = await this.ctx.model.FullRun.findOne({
      where: { project_id: project.id, status: 'running' },
    });
    if (running) this.ctx.throw(409, '已有全流程在执行');
    const assetWorkflow = await this.imageChoice(payload.asset_workflow_id);
    const assetSize = imageSize(payload.asset_width, payload.asset_height);
    const run = await this.ctx.model.FullRun.create({
      project_id: project.id,
      import_id: chapter.id,
      chapter_title: chapter.chapter_title || '未命名章节',
      status: 'running',
      current_node: 'assets',
      message: NODE_LABEL.assets,
      nodes: JSON.stringify(blankNodes()),
      log: '[]',
      asset_workflow_id: assetWorkflow.id,
      frame_workflow_id: 0,
      video_workflow_id: 0,
      asset_workflow_name: assetWorkflow.name || '',
      frame_workflow_name: '',
      video_workflow_name: '',
      asset_width: assetSize.width,
      asset_height: assetSize.height,
      frame_width: 0,
      frame_height: 0,
      fresh: false,
      scope: 'assets',
    });
    const runId = run.id;
    setImmediate(() => {
      this.app.createAnonymousContext().service.fullAuto.walk(runId)
        .catch(err => this.app.logger.error('[cartoon] 资产生成中断 %s', err));
    });
    return this.summary(run);
  }

  async stop(projectId, runId) {
    const where = { project_id: projectId, status: 'running' };
    if (runId) where.id = runId;
    const runs = await this.ctx.model.FullRun.findAll({ where });
    cancelProject(this.app, projectId);
    for (const run of runs) {
      this.abort(run.id);
      await run.update({ status: 'stopped', message: '已停止' });
      await this.cancelTasks(run);
      await this.dropTemp(run);
      await this.pushLog(run, run.current_node || 'video', '已停止');
    }
    return { stopped: runs.length };
  }

  async resume() {
    const runs = await this.ctx.model.FullRun.findAll({ where: { status: 'running' } });
    for (const run of runs) {
      const runId = run.id;
      setImmediate(() => {
        this.app.createAnonymousContext().service.fullAuto.walk(runId)
          .catch(err => this.app.logger.error('[cartoon] 全流程恢复失败 %s', err));
      });
    }
  }

  async alive(run) {
    const fresh = await run.reload();
    return fresh.status === 'running';
  }

  async pushLog(run, node, text) {
    const log = parseJson(run.log, []);
    log.push({ at: new Date().toISOString(), node, text: String(text || '').slice(0, 500) });
    const trimmed = log.slice(-200);
    const raw = JSON.stringify(trimmed);
    await run.update({ log: raw });
    run.log = raw;
  }

  async mark(run, key, status, note) {
    const nodes = parseJson(run.nodes, blankNodes());
    const prev = nodes[key] || {};
    const noteText = note || '';
    const sameStep = status === 'running' && prev.status === 'running' && prev.note === noteText;
    const startedAt = status === 'running'
      ? (sameStep && prev.started_at ? prev.started_at : new Date().toISOString())
      : (prev.started_at || '');
    nodes[key] = { status, note: noteText, started_at: startedAt };
    const patch = {
      nodes: JSON.stringify(nodes),
      current_node: key,
    };
    if (status === 'running' && note) patch.message = note;
    await run.update(patch);
    run.nodes = patch.nodes;
    run.current_node = key;
    if (patch.message) run.message = patch.message;
  }

  async runNode(run, key, fn) {
    if (!await this.alive(run)) return false;
    const nodes = parseJson(run.nodes, blankNodes());
    if (nodes[key]?.status === 'success') return true;
    await this.mark(run, key, 'running', NODE_LABEL[key]);
    await this.pushLog(run, key, NODE_LABEL[key]);
    try {
      await fn();
      if (!await this.alive(run)) {
        await this.mark(run, key, 'stopped', '已停止');
        return false;
      }
      await this.mark(run, key, 'success', '已完成');
      return true;
    } catch (err) {
      if (isStop(err) || !await this.alive(run)) {
        await this.mark(run, key, 'stopped', '已停止');
        if (run.status === 'running') await run.update({ status: 'stopped', message: '已停止' });
        return false;
      }
      const message = err?.message || '失败';
      await this.mark(run, key, 'failed', message);
      await this.pushLog(run, key, message);
      await run.update({ status: 'failed', message, error_message: message, current_node: key });
      this.ctx.logger.warn('[cartoon] full-auto %s %s %s', run.id, key, message);
      return false;
    }
  }

  async walk(runId) {
    const busy = this.walking();
    if (busy.has(runId)) return;
    busy.add(runId);
    const run = await this.ctx.model.FullRun.findByPk(runId);
    if (!run || run.status !== 'running') {
      busy.delete(runId);
      return;
    }
    try {
      const steps = run.scope === 'assets'
        ? [ [ 'assets', () => this.stepAssets(run) ] ]
        : [
          [ 'script', () => this.stepScript(run) ],
          [ 'assets', () => this.stepAssets(run) ],
          [ 'storyboard', () => this.stepStoryboard(run) ],
          [ 'prompts', () => this.stepPrompts(run) ],
          [ 'workflow', () => this.stepWorkflow(run) ],
          [ 'video', () => this.stepVideo(run) ],
        ];
      for (const [ key, fn ] of steps) {
        const ok = await this.runNode(run, key, fn);
        if (!ok) return;
      }
      if (await this.alive(run)) {
        const done = run.scope === 'assets' ? '资产已生成' : '全流程已完成';
        await run.update({ status: 'success', current_node: 'done', message: done, error_message: '' });
        await this.pushLog(run, run.scope === 'assets' ? 'assets' : 'video', done);
      }
    } finally {
      await this.dropTemp(run);
      this.abort(run.id);
      busy.delete(runId);
    }
  }

  async stepScript(run) {
    const current = await this.ctx.model.Import.findByPk(run.import_id);
    const existing = current?.script_data?.scenes;
    if (!run.fresh && Array.isArray(existing) && existing.length) {
      await this.pushLog(run, 'script', `已有剧本，${existing.length} 场`);
      return;
    }
    await this.ctx.service.draft.suggestScript(run.project_id, run.import_id);
    const chapter = await this.ctx.model.Import.findByPk(run.import_id);
    const scenes = chapter?.script_data?.scenes;
    if (!Array.isArray(scenes) || !scenes.length) throw new Error('剧本没有场次');
    await this.pushLog(run, 'script', `剧本已写入，${scenes.length} 场`);
  }

  sheetPlan(chapter) {
    const script = chapter?.script_data || {};
    const body = String(chapter?.body || '');
    const people = [];
    const seenPeople = new Set();
    (Array.isArray(script.characters) ? script.characters : []).forEach(item => {
      const name = String(item?.name || '').trim();
      if (!name || seenPeople.has(name)) return;
      seenPeople.add(name);
      people.push({
        kind: 'character',
        name,
        look: String(item.look || '').trim(),
        note: String(item.stage_note || '').trim(),
      });
    });
    const places = [];
    const seenPlaces = new Set();
    const placeRows = Array.isArray(script.places) && script.places.length
      ? script.places
      : (Array.isArray(script.scenes) ? script.scenes.map(scene => ({ name: scene.title || scene.name, note: scene.summary || '' })) : []);
    placeRows.forEach(item => {
      const name = String(item?.name || item?.title || '').trim();
      if (!name || seenPlaces.has(name)) return;
      seenPlaces.add(name);
      const note = String(item.note || item.stage_note || '').trim();
      places.push({
        kind: 'scene',
        name,
        look: sceneBrief(script, name, note) || String(item.summary || '').trim(),
        note,
      });
    });
    const placeNames = places.map(item => item.name);
    people.forEach(item => {
      const others = people.map(person => person.name).concat(placeNames);
      item.look = ownPassage({ name: item.name, look: item.look, note: item.note, body, others });
      item.note = item.look ? '' : '正文里没有能单独归到这个人的外形。只按名称和视觉风格画，不要借用别人的头发、眼睛或衣服。';
      item.sparse = false;
    });
    places.forEach(item => {
      const others = people.map(person => person.name).concat(placeNames);
      item.look = ownPassage({ name: item.name, look: item.look, note: item.note, body, others });
      item.note = '';
      item.sparse = sceneIsSparse(item.name, item.look);
      if (item.sparse) item.look = '';
    });
    return people.concat(places);
  }

  async stepAssets(run) {
    const chapter = await this.ctx.model.Import.findByPk(run.import_id);
    const project = await this.ctx.model.Project.findByPk(run.project_id);
    const style = await this.ctx.service.draft.styleContext(project, chapter);
    for (const item of this.sheetPlan(chapter)) {
      if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
      await this.ensureSheet(run, chapter, style, item);
    }
  }

  async ensureSheet(run, chapter, style, item, options = {}) {
    const assets = await this.ctx.model.Asset.findAll({
      where: { project_id: run.project_id, kind: item.kind, disabled: false },
    });
    let asset = assets.find(row => String(row.name || '').trim() === item.name);
    const description = assetText(item);
    const hasSheet = asset && this.assetFile(run.project_id, asset.reference_path);
    if (hasSheet) {
      if (description && !String(asset.description || '').trim()) await asset.update({ description });
      await this.pushLog(run, options.quiet ? 'video' : 'assets', `${item.kind === 'scene' ? '场景' : '人物'}「${item.name}」已有设定图`);
      return;
    }
    if (!options.quiet) {
      await this.mark(run, 'assets', 'running', `正在生成${item.kind === 'scene' ? '场景' : '人物'}「${item.name}」`);
    }
    const result = await invokeSkill(this.ctx, {
      skill: 'cartoon-asset-sheet-skill',
      action: 'draft',
      signal: this.signal(run.id),
      payload: {
        kind: item.kind,
        name: item.name,
        look: item.look,
        note: item.note,
        visual_style_label: style?.visual_style_label || '',
        sparse: Boolean(item.sparse),
      },
    });
    const prompt = polishSheetPrompt(sheetPrompt(result));
    if (!prompt) throw new Error(`没有返回「${item.name}」的设定图提示词`);
    if (!asset) {
      asset = await this.ctx.service.project.addAsset(run.project_id, {
        kind: item.kind,
        name: item.name,
        description,
        consistency_note: prompt,
      });
    }
    const file = await this.renderSheet(run, prompt);
    const saved = await this.ctx.service.project.saveAssetImage(run.project_id, {
      filename: 'sheet.png',
      data_base64: file.toString('base64'),
    });
    const patch = { reference_path: saved.path };
    if (description && !String(asset.description || '').trim()) patch.description = description;
    if (prompt && !String(asset.consistency_note || '').trim()) patch.consistency_note = prompt;
    await asset.update(patch);
    await this.pushLog(run, options.quiet ? 'video' : 'assets', `${item.kind === 'scene' ? '场景' : '人物'}「${item.name}」已生成一张设定总图`);
  }

  async renderSheet(run, prompt) {
    const task = await this.ctx.model.Task.create({
      project_id: run.project_id,
      shot_id: null,
      kind: 'image',
      status: 'queued',
      node_name: '设定图',
      model_profile: 'comfy-local',
    });
    await this.track(run, task.id);
    let saved = await this.ctx.service.generate.execute(task, prompt, [], {
      workflowOverride: run.asset_workflow_id,
      seed: rollSeed(),
      signal: this.signal(run.id),
      width: run.asset_width,
      height: run.asset_height,
    });
    saved = await this.awaitTask(run, saved);
    if (!saved || saved.status !== 'success') throw new Error(saved?.error_message || '设定图没有生成');
    return this.readOutput(saved.id);
  }

  async stepStoryboard(run) {
    const count = await this.ctx.model.Shot.count({
      where: { project_id: run.project_id, import_id: run.import_id },
    });
    if (!run.fresh && count) {
      await this.pushLog(run, 'storyboard', `已有 ${count} 条分镜`);
      return;
    }
    await this.ctx.service.draft.suggestShotOutline(run.project_id, run.import_id, { replace: true });
    const saved = await this.ctx.model.Shot.count({
      where: { project_id: run.project_id, import_id: run.import_id },
    });
    if (!saved) throw new Error('分镜没有落库');
    await this.pushLog(run, 'storyboard', `已落库 ${saved} 条分镜`);
  }

  async stepPrompts(run) {
    const shots = await this.shotsOf(run);
    for (const shot of shots) {
      if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
      await this.fillShotPrompt(run, shot, { force: Boolean(run.fresh) });
    }
  }

  promptReady(row) {
    return Boolean(row
      && String(row.positive_zh || '').trim()
      && String(row.frame_start_zh || '').trim()
      && String(row.frame_end_zh || '').trim()
      && String(row.negative_zh || '').trim());
  }

  async fillShotPrompt(run, shot, options = {}) {
    const code = shot.shot_code || shot.id;
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const existing = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
      if (!options.force && this.promptReady(existing)) {
        if (attempt === 1 && !options.quiet) await this.pushLog(run, 'prompts', `${code} 已有提示词`);
        return existing;
      }
      if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
      await this.mark(run, 'prompts', 'running', `正在生成提示词 ${code}`);
      try {
        await this.ctx.service.draft.expandShot(run.project_id, run.import_id, {
          shot_id: shot.id,
          repair_note: attempt > 1 ? '上一次没有返回视频提示词，只回复了已写入。这次必须写出 positive_zh、frame_start_zh、frame_end_zh 和 negative_zh。' : '',
        });
      } catch (err) {
        if (isStop(err)) throw err;
        lastError = err;
        await this.pushLog(run, 'prompts', `${code} 第 ${attempt} 次没有写全提示词，继续生成这一镜`);
        continue;
      }
      const saved = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
      if (this.promptReady(saved)) {
        await this.pushLog(run, 'prompts', `${code} 已写入视频、首帧、尾帧提示词`);
        return saved;
      }
      lastError = new Error(`${code} 没有返回视频提示词`);
      await this.pushLog(run, 'prompts', `${code} 第 ${attempt} 次没有写全提示词，继续生成这一镜`);
    }
    throw lastError || new Error(`${code} 没有返回视频提示词`);
  }

  async stepWorkflow(run) {
    await this.ctx.model.Shot.update(
      { workflow_id: run.video_workflow_id },
      { where: { project_id: run.project_id, import_id: run.import_id } },
    );
    await this.pushLog(run, 'workflow', `每镜使用 ${run.video_workflow_name}`);
  }

  async videoShotIds(projectId, shotIds) {
    const ids = (shotIds || []).map(id => Number(id)).filter(id => id > 0);
    if (!ids.length) return new Set();
    const tasks = await this.ctx.model.Task.findAll({
      where: {
        project_id: projectId,
        shot_id: ids,
        status: 'success',
        kind: VIDEO_KINDS,
      },
    });
    if (!tasks.length) return new Set();
    const outputs = await this.ctx.model.Output.findAll({
      where: { task_id: tasks.map(item => item.id), media_kind: 'video' },
    });
    const readyTasks = new Set(outputs.filter(item => item.file_path).map(item => Number(item.task_id)));
    const shots = new Set();
    tasks.forEach(task => {
      if (readyTasks.has(Number(task.id))) shots.add(Number(task.shot_id));
    });
    return shots;
  }

  async dropFreshFrames(run, shot) {
    const names = [ 'manual.png', 'end.png' ];
    for (const name of names) {
      const relative = `frames/${run.project_id}/${shot.id}/${name}`;
      const absolute = resolveInside(outputRoot(this.app), relative);
      if (absolute && fs.existsSync(absolute)) await fs.promises.unlink(absolute).catch(() => {});
    }
    if (shot.manual_frame_path) await shot.update({ manual_frame_path: '' });
  }

  async stepVideo(run) {
    const shots = await this.shotsOf(run);
    const chapter = await this.ctx.model.Import.findByPk(run.import_id);
    const script = chapter?.script_data || {};
    const done = new Set(parseJson(run.done_shot_ids, []).map(id => Number(id)));
    await run.update({ video_total: shots.length, video_done: done.size });
    const readyVideos = run.fresh ? new Set() : await this.videoShotIds(run.project_id, shots.map(item => item.id));
    const videoChoice = await this.ctx.service.generate.choiceById(run.video_workflow_id);
    const endSlot = (videoChoice.images || []).find(slot => slot.role === 'end');
    if (!endSlot) throw new Error('满血首尾帧工作流没有尾帧入口');
    let previousScene = '';
    for (let index = 0; index < shots.length; index += 1) {
      const shot = await this.ctx.model.Shot.findByPk(shots[index].id);
      if (!shot) throw new Error('镜头已不在项目里');
      const scene = sceneTitle(script, shot);
      const same = index > 0 && scene && scene === previousScene;
      previousScene = scene || previousScene;
      if (done.has(shot.id)) continue;
      const code = shot.shot_code || shot.id;
      if (readyVideos.has(Number(shot.id))) {
        await this.pushLog(run, 'video', `${code} 已有视频`);
        done.add(shot.id);
        const raw = JSON.stringify([ ...done ]);
        await run.update({ done_shot_ids: raw, video_done: done.size });
        run.done_shot_ids = raw;
        continue;
      }
      if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
      await this.mark(run, 'video', 'running', `正在生成镜头 ${code}（${index + 1}/${shots.length}）`);
      await this.shoot(run, shot, endSlot, same, scene);
      done.add(shot.id);
      const raw = JSON.stringify([ ...done ]);
      await run.update({ done_shot_ids: raw, video_done: done.size });
      run.done_shot_ids = raw;
      await this.pushLog(run, 'video', `${code} 视频已生成`);
    }
  }

  async shoot(run, shot, endSlot, sameScene, scene) {
    const live = await this.ctx.model.Task.findOne({
      where: {
        project_id: run.project_id,
        shot_id: shot.id,
        kind: VIDEO_KINDS,
        status: [ 'queued', 'running', 'saving' ],
      },
      order: [[ 'id', 'DESC' ]],
    });
    if (live?.prompt_id) {
      const code = shot.shot_code || shot.id;
      await this.track(run, live.id);
      await this.pushLog(run, 'video', `${code} 继续等待已经提交的视频`);
      const settled = await this.awaitTask(run, live);
      if (!settled || settled.status !== 'success') throw new Error(settled?.error_message || `${code} 视频没有生成`);
      return;
    }
    if (run.fresh) await this.dropFreshFrames(run, shot);
    const prompt = await this.fillShotPrompt(run, shot, { quiet: true });
    const videoText = String(prompt?.positive_zh || '').trim();
    const frameStart = String(prompt?.frame_start_zh || '').trim();
    const frameEnd = String(prompt?.frame_end_zh || '').trim();
    const negative = String(prompt?.negative_zh || '').trim();
    const code = shot.shot_code || shot.id;
    const startFile = await this.ensureStartFrame(run, shot, sameScene, scene, videoText, frameStart, frameEnd, negative);
    const endFile = await this.ensureEndFrame(run, shot, videoText, frameStart, frameEnd, negative);
    if (!startFile || !endFile) throw new Error(`${code} 首尾帧没有生成`);
    await this.mark(run, 'video', 'running', `正在生成镜头 ${code}`);
    const packId = await this.stageShotPack(run, shot);
    try {
      const bindings = await this.ctx.model.ShotBinding.findAll({ where: { shot_id: shot.id } });
      const assetIds = bindings.map(item => Number(item.asset_id)).filter(id => id > 0);
      let task = await this.ctx.service.generate.start(run.project_id, shot.id, {
        positive_zh: videoText,
        frame_start_zh: frameStart,
        frame_end_zh: frameEnd,
        negative_zh: negative,
        workflow_id: run.video_workflow_id,
        asset_ids: assetIds,
        duration_sec: shot.duration_ms ? Math.max(1, Math.round(shot.duration_ms / 1000)) : 10,
        seed: rollSeed(),
        ephemeral_refmod_id: packId,
        images: [{
          id: endSlot.id,
          slot_id: endSlot.id,
          filename: 'end.png',
          data_base64: endFile.toString('base64'),
        }],
      }, 'refmod');
      if (task?.id) await this.track(run, task.id);
      if (!await this.alive(run)) {
        if (task?.id) await this.cancelTask(task);
        throw Object.assign(new Error('已停止'), { stop: true });
      }
      if ([ 'queued', 'running', 'saving' ].includes(task?.status)) task = await this.awaitTask(run, task);
      if (!task || task.status !== 'success') throw new Error(task?.error_message || `${shot.shot_code || shot.id} 视频没有生成`);
    } finally {
      await this.dropTemp(run);
    }
  }

  frameAbsolute(relative) {
    if (!relative) return null;
    const absolute = resolveInside(outputRoot(this.app), String(relative).split('?')[0]);
    if (!absolute || !fs.existsSync(absolute)) return null;
    return absolute;
  }

  async ensureStartFrame(run, shot, sameScene, scene, videoText, frameStart, frameEnd, negative) {
    const fresh = await shot.reload();
    const code = shot.shot_code || shot.id;
    const planted = sameScene ? this.frameAbsolute(fresh.first_frame_path) : null;
    if (planted) {
      await shot.update({ manual_frame_path: '' });
      await this.pushLog(run, 'video', `${code} 与上一镜同一场景「${scene}」，首帧用上一镜尾帧`);
      return fs.readFileSync(planted);
    }
    const manual = this.frameAbsolute(fresh.manual_frame_path);
    if (manual) {
      await this.pushLog(run, 'video', `${code} 已有首帧`);
      return fs.readFileSync(manual);
    }
    await this.pushLog(run, 'video', `${code} 缺少首帧，按提示词生成`);
    const file = await this.renderFrame(run, shot, 'start', videoText, frameStart, frameEnd, negative);
    await this.ctx.service.project.saveManualFrame(run.project_id, shot.id, {
      filename: 'manual.png',
      data_base64: file.toString('base64'),
    });
    return file;
  }

  async ensureEndFrame(run, shot, videoText, frameStart, frameEnd, negative) {
    const code = shot.shot_code || shot.id;
    const relative = `frames/${run.project_id}/${shot.id}/end.png`;
    const existing = this.frameAbsolute(relative);
    if (existing) {
      await this.pushLog(run, 'video', `${code} 已有尾帧`);
      return fs.readFileSync(existing);
    }
    await this.pushLog(run, 'video', `${code} 缺少尾帧，按提示词生成`);
    const file = await this.renderFrame(run, shot, 'end', videoText, frameStart, frameEnd, negative);
    const absolute = resolveInside(outputRoot(this.app), relative);
    if (!absolute) throw new Error(`${code} 尾帧路径无效`);
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    await fs.promises.writeFile(absolute, file);
    return file;
  }

  async renderFrame(run, shot, target, videoText, frameStart, frameEnd, negative) {
    const choice = await this.ctx.service.generate.choiceById(run.frame_workflow_id);
    const images = await this.frameReferenceImages(run, shot, choice, target);
    let task = await this.ctx.service.generate.start(run.project_id, shot.id, {
      positive_zh: videoText,
      frame_start_zh: frameStart,
      frame_end_zh: frameEnd,
      negative_zh: negative,
      workflow_id: run.frame_workflow_id,
      frame_target: target,
      seed: rollSeed(),
      asset_ids: [],
      images,
      width: run.frame_width,
      height: run.frame_height,
    }, 'image');
    if (task?.id) await this.track(run, task.id);
    if ([ 'queued', 'running', 'saving' ].includes(task?.status)) task = await this.awaitTask(run, task);
    if (!task || task.status !== 'success') {
      throw new Error(task?.error_message || `${shot.shot_code || shot.id} ${target === 'end' ? '尾帧' : '首帧'}没有生成`);
    }
    return this.readOutput(task.id);
  }

  referenceSlots(choice) {
    return (choice?.images || []).filter(slot => slot.role === 'reference' || slot.role === 'image');
  }

  referenceCap(choice) {
    const slots = this.referenceSlots(choice);
    if (!slots.length) return 0;
    const expanded = slots.find(slot => slot.expand && Number(slot.limit) > 1);
    if (expanded) return Number(expanded.limit);
    return slots.reduce((sum, slot) => sum + (Number(slot.limit) > 0 ? Number(slot.limit) : 1), 0);
  }

  async frameReferenceImages(run, shot, choice, target) {
    const slots = this.referenceSlots(choice);
    const cap = this.referenceCap(choice);
    if (!cap || !/图生图/.test(choice?.name || '')) return [];
    const files = await this.shotSheetFiles(run, shot, cap);
    const code = shot.shot_code || shot.id;
    if (!files.length) throw new Error(`${code} 图生图首尾帧需要这一镜的人物或场景设定图`);
    const label = target === 'end' ? '尾帧' : '首帧';
    await this.pushLog(run, 'video', `${code} ${label}参考 ${files.map(file => file.label).join('、')}（最多 ${cap} 张）`);
    const slot = slots[0];
    const batch = files.map((file, index) => ({
      filename: `ref-${index + 1}${file.ext || '.png'}`,
      data_base64: file.bytes.toString('base64'),
    }));
    if (slot.expand || slots.length === 1) {
      return [{ id: slot.id, slot_id: slot.id, files: batch }];
    }
    return batch.map((file, index) => ({
      id: slots[index].id,
      slot_id: slots[index].id,
      filename: file.filename,
      data_base64: file.data_base64,
    }));
  }

  async shotSheetFiles(run, shot, cap) {
    const prompt = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
    const blob = [ shot.description, shot.dialogue, prompt?.positive_zh, prompt?.frame_start_zh, prompt?.frame_end_zh ].filter(Boolean).join('\n');
    const chapter = await this.ctx.model.Import.findByPk(run.import_id);
    const project = await this.ctx.model.Project.findByPk(run.project_id);
    const style = await this.ctx.service.draft.styleContext(project, chapter);
    const matched = this.sheetPlan(chapter)
      .filter(item => blob.includes(item.name))
      .sort((a, b) => b.name.length - a.name.length)
      .filter((item, index, list) => !list.slice(0, index).some(kept => kept.name.includes(item.name)));
    for (const item of matched) {
      if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
      const existing = await this.ctx.model.Asset.findOne({
        where: { project_id: run.project_id, kind: item.kind, name: item.name, disabled: false },
      });
      if (existing && this.assetFile(run.project_id, existing.reference_path)) continue;
      await this.ensureSheet(run, chapter, style, item, { keepExisting: true, quiet: true });
    }
    await this.ctx.service.project.bindMatchedAssets(run.project_id, shot.id, blob);
    const bindings = await this.ctx.model.ShotBinding.findAll({ where: { shot_id: shot.id } });
    const assets = bindings.length
      ? await this.ctx.model.Asset.findAll({
        where: { id: bindings.map(item => item.asset_id), project_id: run.project_id, disabled: false },
      })
      : [];
    const characterFiles = [];
    const sceneFiles = [];
    for (const asset of assets) {
      if (asset.kind !== 'character' && asset.kind !== 'scene') continue;
      const absolute = this.assetFile(run.project_id, asset.reference_path);
      if (!absolute) continue;
      const kindLabel = asset.kind === 'scene' ? '场景' : '人物';
      const file = {
        name: String(asset.name || '').trim(),
        label: `${kindLabel}「${asset.name}」`,
        bytes: fs.readFileSync(absolute),
        ext: path.extname(absolute) || '.png',
      };
      if (asset.kind === 'scene') sceneFiles.push(file);
      else characterFiles.push(file);
    }
    const sceneLabel = String(shot.scene_label || '').trim();
    const sceneFile = sceneFiles.find(file => sceneLabel && file.name === sceneLabel) || sceneFiles[0] || null;
    const characterCap = sceneFile && cap > 1 ? cap - 1 : cap;
    const files = characterFiles.slice(0, characterCap);
    if (sceneFile && files.length < cap) files.push(sceneFile);
    if (characterFiles.length > characterCap) {
      await this.pushLog(run, 'video', `${shot.shot_code || shot.id} 人物设定图超过 ${characterCap} 张，场景参考另占最后一格`);
    }
    return files;
  }

  async stageShotPack(run, shot) {
    const text = [ shot.description, shot.dialogue ].filter(Boolean).join('\n');
    const prompt = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
    const blob = [ text, prompt?.positive_zh, prompt?.frame_start_zh, prompt?.frame_end_zh ].join('\n');
    await this.ctx.service.project.bindMatchedAssets(run.project_id, shot.id, blob);
    const bindings = await this.ctx.model.ShotBinding.findAll({ where: { shot_id: shot.id } });
    const assets = bindings.length
      ? await this.ctx.model.Asset.findAll({
        where: { id: bindings.map(item => item.asset_id), project_id: run.project_id, disabled: false },
      })
      : [];
    const characterFiles = [];
    const sceneFiles = [];
    for (const asset of assets) {
      if (asset.kind !== 'character' && asset.kind !== 'scene') continue;
      const absolute = this.assetFile(run.project_id, asset.reference_path);
      if (!absolute) continue;
      const file = {
        name: String(asset.name || '').trim(),
        bytes: fs.readFileSync(absolute),
        ext: path.extname(absolute) || '.png',
        note: asset.kind === 'scene'
          ? `场景「${asset.name}」设定总图，只作为这一镜的场景参考`
          : `人物「${asset.name}」设定总图`,
      };
      if (asset.kind === 'scene') sceneFiles.push(file);
      else characterFiles.push(file);
    }
    const sceneLabel = String(shot.scene_label || '').trim();
    const sceneFile = sceneFiles.find(file => sceneLabel && file.name === sceneLabel) || sceneFiles[0] || null;
    const characterCap = sceneFile ? 8 : 9;
    const files = characterFiles.slice(0, characterCap);
    if (sceneFile) files.push(sceneFile);
    if (!files.length) throw new Error(`${shot.shot_code || shot.id} 没有可合并的设定图`);
    if (characterFiles.length > characterCap) {
      await this.pushLog(run, 'video', `${shot.shot_code || shot.id} 人物设定图超过 ${characterCap} 张，场景参考另占最后一格`);
    }
    const pack = await this.ctx.service.refmod.stageTemporary(run.project_id, {
      name: `临时-${shot.shot_code || shot.id}`,
      files,
    });
    await run.update({ temp_refmod_id: pack.id });
    run.temp_refmod_id = pack.id;
    return pack.id;
  }

  assetFile(projectId, referencePath) {
    const name = path.basename(String(referencePath || '').split('?')[0]);
    if (!name) return null;
    const relative = path.join('asset-files', String(projectId), name);
    const absolute = resolveInside(outputRoot(this.app), relative);
    if (!absolute || !fs.existsSync(absolute)) return null;
    return absolute;
  }

  async readOutput(taskId) {
    const output = await this.ctx.model.Output.findOne({
      where: { task_id: taskId, media_kind: 'image' },
      order: [[ 'id', 'DESC' ]],
    });
    if (!output?.file_path) throw new Error('没有找到生成的图片');
    const absolute = resolveInside(outputRoot(this.app), output.file_path);
    if (!absolute || !fs.existsSync(absolute)) throw new Error('生成的图片不在磁盘上');
    return fs.readFileSync(absolute);
  }

  async shotsOf(run) {
    return this.ctx.model.Shot.findAll({
      where: { project_id: run.project_id, import_id: run.import_id },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
  }

  async track(run, taskId) {
    const ids = parseJson(run.task_ids, []);
    ids.push(Number(taskId));
    const raw = JSON.stringify(ids);
    await run.update({ task_ids: raw });
    run.task_ids = raw;
  }

  async awaitTask(run, task) {
    if (!task?.id) throw new Error('没有拿到生成任务');
    const deadline = Date.now() + WAIT_LIMIT_MS;
    let current = task;
    while (await this.alive(run)) {
      const fresh = await this.ctx.model.Task.findByPk(current.id);
      if (!fresh) return null;
      if ([ 'success', 'failed', 'cancelled' ].includes(fresh.status)) return fresh;
      if (Date.now() > deadline) {
        if (fresh.prompt_id) await this.ctx.service.generate.dropComfyPrompts([ fresh.prompt_id ]);
        await fresh.update({ status: 'failed', error_message: '这一条等待超时' });
        return fresh.reload();
      }
      const queue = await this.ctx.service.generate.comfyQueue();
      await this.ctx.service.generate.settleTask(fresh, queue);
      const settled = await fresh.reload();
      if ([ 'success', 'failed', 'cancelled' ].includes(settled.status)) return settled;
      await sleep(3000, this.signal(run.id));
      current = settled;
    }
    const latest = await this.ctx.model.Task.findByPk(current.id);
    if (latest && [ 'queued', 'running', 'saving' ].includes(latest.status)) await this.cancelTask(latest);
    const err = new Error('已停止');
    err.stop = true;
    throw err;
  }

  async cancelTasks(run) {
    const ids = parseJson(run.task_ids, []).map(id => Number(id)).filter(id => id > 0);
    if (!ids.length) return;
    const tasks = await this.ctx.model.Task.findAll({
      where: {
        id: ids,
        status: [ 'pending', 'queued', 'running', 'saving' ],
      },
    });
    await this.ctx.service.generate.dropComfyPrompts(tasks.map(item => item.prompt_id));
    for (const task of tasks) {
      await task.update({ status: 'cancelled', error_message: '已停止' });
    }
    const live = await this.ctx.model.Task.findAll({
      where: {
        project_id: run.project_id,
        status: [ 'queued', 'running', 'saving' ],
        kind: VIDEO_KINDS,
      },
    });
    const owned = live.filter(item => ids.includes(item.id));
    if (owned.length) await this.ctx.service.generate.dropComfyPrompts(owned.map(item => item.prompt_id));
  }

  async cancelTask(task) {
    if (!task?.id) return;
    if (task.prompt_id) await this.ctx.service.generate.dropComfyPrompts([ task.prompt_id ]);
    const fresh = await this.ctx.model.Task.findByPk(task.id);
    if (fresh && [ 'pending', 'queued', 'running', 'saving' ].includes(fresh.status)) {
      await fresh.update({ status: 'cancelled', error_message: '已停止' });
    }
  }

  async dropTemp(run) {
    const id = Number(run.temp_refmod_id);
    if (!id) return;
    try {
      await this.ctx.service.refmod.remove(run.project_id, id);
    } catch (err) {
      this.ctx.logger.warn('[cartoon] full-auto drop refmod %s', err.message);
    }
    if (run.status) {
      await run.update({ temp_refmod_id: null });
      run.temp_refmod_id = null;
    }
  }
}

module.exports = FullAutoService;
