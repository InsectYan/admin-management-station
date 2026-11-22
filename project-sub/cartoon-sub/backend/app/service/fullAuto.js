'use strict';

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const Service = require('egg').Service;
const { invokeSkill } = require('../lib/agentProxy');
const { cancelProject } = require('../lib/activeRuns');
const { outputRoot, resolveInside } = require('../lib/mediaPaths');
const { ownPassage, sceneIsSparse, polishSheetPrompt } = require('../lib/assetExcerpt');
const {
  mergeCharacter,
  mergeScene,
  appendCostume,
  sceneTypeOf,
  splitBody,
  rosterText,
  briefLook,
} = require('../lib/assetProfile');
const { settleScript } = require('../lib/scriptGate');
const { promptCoveredMs, fitDurationSec } = require('../lib/promptDuration');
const { topicsOf } = require('../lib/topics');

const NODE_KEYS = [ 'script', 'profiles', 'assets', 'storyboard', 'prompts', 'workflow', 'video' ];
const NOTE_NODES = {
  storyboard: [ 'script', 'storyboard' ],
  prompt: [ 'prompts', 'save' ],
  prompt_video: [ 'prompts', 'video' ],
};
const NODE_LABEL = {
  script: '正在生成剧本',
  profiles: '正在生成资产描述',
  assets: '正在生成资产',
  storyboard: '正在拆分分镜',
  prompts: '正在生成提示词',
  workflow: '正在确认工作流',
  video: '正在生成镜头',
};
const VIDEO_KINDS = [ 'video', 'i2v', 't2v', 'refmod' ];
const WAIT_LIMIT_MS = 2 * 60 * 60 * 1000;

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

function takeFreshSeed(bag) {
  let seed = rollSeed();
  for (let attempt = 0; attempt < 12 && bag.has(seed); attempt += 1) seed = rollSeed();
  bag.add(seed);
  return seed;
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

const UNDERAGE_RE = /十几岁|未成年|婴儿|幼童|小孩|孩童|少女|少年|(?<![二三四五六七八九])(?:十一|十二|十三|十四|十五|十六|十七|十八|十九|二十)岁|(?<![十廿])[一二三四五六七八九]岁/;
const ADULT_CN_RE = /二十[一二三四五六七八九]岁|[三四五六七八九]十[一二三四五六七八九]?岁/;
const NUDE_LINE = '人物全裸，细节刻画清晰，禁止非全裸，禁止穿衣服，禁止半裸。';

function adultAge(text) {
  const source = String(text || '');
  if (UNDERAGE_RE.test(source)) return false;
  const ages = [ ...source.matchAll(/(\d{1,3})\s*岁/g) ]
    .map(item => Number(item[1]))
    .filter(age => age >= 0 && age <= 120);
  if (ages.some(age => age < 21)) return false;
  if (ages.length && ages.every(age => age >= 21)) return true;
  return ADULT_CN_RE.test(source);
}

function videoCount(value) {
  const count = Math.round(Number(value == null || value === '' ? 1 : value));
  if (!Number.isInteger(count) || count < 1 || count > 8) {
    const err = new Error('每个镜头的视频条数需要是 1 到 8');
    err.status = 400;
    throw err;
  }
  return count;
}

function assetText(item) {
  if (item.kind === 'scene') return String(item.look || '').trim().slice(0, 4000);
  return briefLook(item.look);
}

function scriptCast(chapter) {
  const people = Array.isArray(chapter?.script_data?.characters) ? chapter.script_data.characters : [];
  return people.map(item => {
    const name = String(item?.name || '').trim();
    if (!name) return '';
    const look = briefLook(item.look);
    return look ? `${name}｜${look}` : name;
  }).filter(Boolean).join('\n').slice(0, 2000);
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

function sceneKey(shot) {
  const index = Number(shot?.scene_index);
  if (Number.isInteger(index) && index > 0) return `n:${index}`;
  const label = String(shot?.scene_label || '').trim();
  return label ? `l:${label}` : '';
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

  signalKey(run) {
    if (run?.signal_key) return String(run.signal_key);
    return String(run?.id ?? '');
  }

  signal(runId) {
    const map = this.signals();
    const key = String(runId);
    if (!map.has(key)) map.set(key, new AbortController());
    return map.get(key).signal;
  }

  abort(runId) {
    const map = this.signals();
    const key = String(runId);
    const controller = map.get(key);
    if (controller) controller.abort();
    map.delete(key);
  }

  llmColumns() {
    const session = this.ctx.state?.llmSession || {};
    const profile = String(session.llm_profile || '').trim().slice(0, 80);
    const maxTokens = Number(session.max_tokens);
    return {
      llm_profile: profile,
      max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? Math.min(Math.round(maxTokens), 131072) : 0,
    };
  }

  bindRunLlm(run) {
    const profile = String(run?.llm_profile || '').trim();
    const maxTokens = Number(run?.max_tokens);
    const session = {};
    if (profile) session.llm_profile = profile;
    if (Number.isFinite(maxTokens) && maxTokens > 0) session.max_tokens = maxTokens;
    this.ctx.state.llmSession = session;
  }

  modelLine(run) {
    const profile = String(run?.llm_profile || '').trim();
    const maxTokens = Number(run?.max_tokens) || 0;
    if (!profile && !maxTokens) return '';
    const tokenText = maxTokens ? `，最大 token ${maxTokens}` : '';
    return `本次模型：${profile || '技能默认'}${tokenText}`;
  }

  hadFault(nodes) {
    return Object.values(nodes || {}).some(node => node?.status === 'failed' || (Array.isArray(node?.failures) && node.failures.length));
  }

  presentStatus(status, faulted) {
    if ((status === 'success' || status === 'done') && faulted) return 'exception';
    return status;
  }

  summary(run) {
    const nodes = parseJson(run.nodes, {});
    return {
      id: run.id,
      project_id: run.project_id,
      import_id: run.import_id,
      chapter_title: run.chapter_title || '',
      status: this.presentStatus(run.status, this.hadFault(nodes)),
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
      run_kind: this.kindOf(run),
      source: 'run',
      nodes,
      log: parseJson(run.log, []),
      llm_profile: run.llm_profile || '',
      max_tokens: Number(run.max_tokens) || 0,
      data_kind: run.data_kind || '',
      data_seq: Number(run.data_seq) || 0,
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
    const jobs = await this.ctx.model.AutoJob.findAll({
      where: { project_id: project.id },
      order: [[ 'id', 'DESC' ]],
    });
    const jobIds = jobs.map(job => job.id);
    const jobItems = jobIds.length
      ? await this.ctx.model.AutoJobItem.findAll({ where: { job_id: jobIds } })
      : [];
    const itemsByJob = new Map();
    jobItems.forEach(item => {
      const key = Number(item.job_id);
      if (!itemsByJob.has(key)) itemsByJob.set(key, []);
      itemsByJob.get(key).push(item);
    });
    return [ ...rows.map(row => this.summary(row)), ...jobs.map(job => this.jobSummary(job, itemsByJob.get(Number(job.id)) || [])) ]
      .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
  }

  kindOf(run) {
    if (run.run_kind && run.run_kind !== 'full') return run.run_kind;
    if (run.scope === 'profiles') return 'profiles';
    if (run.scope === 'assets' || run.scope === 'assets-reset') return 'assets';
    return run.run_kind || 'full';
  }

  pipelineWhere(projectId) {
    const { Op } = this.app.Sequelize;
    return {
      project_id: projectId,
      status: 'running',
      scope: { [Op.ne]: 'note' },
    };
  }

  faultLines(items) {
    const lines = [];
    (items || []).forEach(item => {
      const code = item.shot_code || item.shot_id || '';
      let stored = [];
      try {
        const parsed = JSON.parse(item.failures || '[]');
        stored = Array.isArray(parsed) ? parsed : [];
      } catch {
        stored = [];
      }
      stored.forEach(entry => {
        const message = String(entry?.message || '').trim();
        if (message) lines.push(`${code}：${message}`);
      });
      if (!stored.length && item.status === 'failed' && item.reason) {
        lines.push(`${code}：${item.reason}`);
      }
    });
    return lines;
  }

  jobSummary(job, items = []) {
    const faults = this.faultLines(items);
    const status = this.presentStatus(job.status === 'done' ? 'success' : job.status, faults.length > 0);
    return {
      id: job.id,
      project_id: job.project_id,
      import_id: null,
      chapter_title: '视频一键执行',
      status,
      current_node: status === 'running' ? 'submit' : 'end',
      message: `完成 ${job.done || 0}/${job.total || 0}，成功 ${job.success_count || 0}`,
      error_message: '',
      video_done: job.done || 0,
      video_total: job.total || 0,
      run_kind: 'video',
      source: 'job',
      faults,
      llm_profile: job.llm_profile || '',
      max_tokens: Number(job.max_tokens) || 0,
      data_kind: job.data_kind || '',
      data_seq: Number(job.data_seq) || 0,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }

  async showJob(projectId, jobId) {
    const job = await this.ctx.model.AutoJob.findOne({ where: { id: jobId, project_id: projectId } });
    if (!job) this.ctx.throw(404, '这条视频任务不存在');
    const items = await this.ctx.service.autoJob.itemsOf(job.id);
    return {
      ...this.jobSummary(job, items),
      items: items.map(item => ({
        id: item.id,
        shot_id: item.shot_id,
        shot_code: item.shot_code || '',
        status: item.status,
        reason: item.reason || '',
        failures: this.faultLines([ item ]).map(line => line.replace(/^[^：]*：/, '')),
        task_id: item.task_id,
      })),
      faults: this.faultLines(items),
      log: [
        ...(this.modelLine(job) ? [{ at: job.created_at, node: 'submit', text: this.modelLine(job) }] : []),
        ...items.map(item => ({
          at: item.updated_at,
          node: 'submit',
          text: `${item.shot_code || item.shot_id} ${item.reason || item.status}`,
        })),
      ],
    };
  }

  async openNote(projectId, payload) {
    const kind = String(payload.run_kind || '');
    const keys = NOTE_NODES[kind];
    if (!keys) this.ctx.throw(400, '这个类型不能这样记');
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const chapter = await this.ctx.model.Import.findOne({
      where: { id: payload.import_id, project_id: project.id },
    });
    if (!chapter || chapter.deleted_at) this.ctx.throw(404, '章节快照不存在');
    const nodes = Object.fromEntries(keys.map((key, index) => [ key, { status: index ? 'pending' : 'running', note: '' } ]));
    const run = await this.ctx.model.FullRun.create({
      project_id: project.id,
      import_id: chapter.id,
      chapter_title: chapter.chapter_title || '未命名章节',
      status: 'running',
      current_node: keys[0],
      message: payload.message || '已发起',
      nodes: JSON.stringify(nodes),
      log: '[]',
      asset_workflow_id: 0,
      frame_workflow_id: 0,
      video_workflow_id: 0,
      scope: 'note',
      run_kind: kind,
      ...this.llmColumns(),
    });
    await this.pushLog(run, keys[0], payload.message || '已发起');
    const modelText = this.modelLine(run);
    if (modelText) await this.pushLog(run, keys[0], modelText);
    return this.detail(run);
  }

  async patchNote(projectId, noteId, payload) {
    const run = await this.ctx.model.FullRun.findOne({
      where: { id: noteId, project_id: projectId, scope: 'note' },
    });
    if (!run) this.ctx.throw(404, '这条记录不存在');
    const nodes = parseJson(run.nodes, {});
    (Array.isArray(payload.done) ? payload.done : []).forEach(key => {
      if (nodes[key]) nodes[key] = { status: 'success', note: '' };
    });
    const status = [ 'running', 'success', 'failed', 'stopped' ].includes(payload.status) ? payload.status : run.status;
    const current = payload.current_node && nodes[payload.current_node] ? payload.current_node : run.current_node;
    if (nodes[current] && status === 'running') nodes[current] = { status: 'running', note: payload.message || '' };
    if (nodes[current] && status === 'failed') nodes[current] = { status: 'failed', note: payload.message || '' };
    if (status === 'success') {
      Object.keys(nodes).forEach(key => {
        nodes[key] = { status: 'success', note: '' };
      });
    }
    if (status === 'stopped') {
      Object.keys(nodes).forEach(key => {
        if (nodes[key]?.status === 'pending' || nodes[key]?.status === 'running') nodes[key] = { status: 'stopped', note: '已停止' };
      });
    }
    await run.update({
      status,
      current_node: current,
      message: payload.message || run.message,
      error_message: status === 'failed' ? (payload.message || '') : '',
      nodes: JSON.stringify(nodes),
    });
    if (payload.message) await this.pushLog(run, current, payload.message);
    return this.detail(await run.reload());
  }

  async active(projectId) {
    const row = await this.ctx.model.FullRun.findOne({
      where: this.pipelineWhere(projectId),
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
    const running = await this.ctx.model.FullRun.findOne({ where: this.pipelineWhere(project.id) });
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
    const generateEnd = payload.generate_end !== false;
    const endSlot = (videoWorkflow.images || []).find(slot => slot.role === 'end');
    if (generateEnd && !endSlot) this.ctx.throw(400, '满血首尾帧工作流没有尾帧入口');
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
      run_kind: 'full',
      video_count: videoCount(payload.video_count),
      generate_end: generateEnd,
      ...this.llmColumns(),
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
    const running = await this.ctx.model.FullRun.findOne({ where: this.pipelineWhere(project.id) });
    if (running) this.ctx.throw(409, '已有全流程在执行');
    const assetWorkflow = await this.imageChoice(payload.asset_workflow_id);
    const assetSize = imageSize(payload.asset_width, payload.asset_height);
    const run = await this.ctx.model.FullRun.create({
      project_id: project.id,
      import_id: chapter.id,
      chapter_title: chapter.chapter_title || '未命名章节',
      status: 'running',
      current_node: 'assets',
      message: payload.reset ? '正在重绘设定图' : NODE_LABEL.assets,
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
      scope: payload.reset ? 'assets-reset' : 'assets',
      run_kind: 'assets',
      ...this.llmColumns(),
    });
    const runId = run.id;
    setImmediate(() => {
      this.app.createAnonymousContext().service.fullAuto.walk(runId)
        .catch(err => this.app.logger.error('[cartoon] 资产生成中断 %s', err));
    });
    return this.summary(run);
  }

  async startProfiles(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const chapters = await this.ctx.model.Import.findAll({
      where: { project_id: project.id, deleted_at: null },
      order: [[ 'id', 'ASC' ]],
    });
    const first = chapters.find(row => String(row.body || '').trim());
    if (!first) this.ctx.throw(400, '没有可读取的章节正文');
    const running = await this.ctx.model.FullRun.findOne({ where: this.pipelineWhere(project.id) });
    if (running) this.ctx.throw(409, '已有全流程在执行');
    const run = await this.ctx.model.FullRun.create({
      project_id: project.id,
      import_id: first.id,
      chapter_title: first.chapter_title || '未命名章节',
      status: 'running',
      current_node: 'assets',
      message: '正在生成资产描述',
      nodes: JSON.stringify(blankNodes()),
      log: '[]',
      asset_workflow_id: 0,
      frame_workflow_id: 0,
      video_workflow_id: 0,
      asset_workflow_name: '',
      frame_workflow_name: '',
      video_workflow_name: '',
      asset_width: 0,
      asset_height: 0,
      frame_width: 0,
      frame_height: 0,
      fresh: false,
      scope: 'profiles',
      run_kind: 'profiles',
      ...this.llmColumns(),
    });
    const runId = run.id;
    setImmediate(() => {
      this.app.createAnonymousContext().service.fullAuto.walk(runId)
        .catch(err => this.app.logger.error('[cartoon] 资产描述中断 %s', err));
    });
    return this.summary(run);
  }

  async stepProfiles(run) {
    const chapters = await this.ctx.model.Import.findAll({
      where: { project_id: run.project_id, deleted_at: null },
      order: [[ 'id', 'ASC' ]],
    });
    const list = chapters.filter(row => String(row.body || '').trim());
    if (!list.length) throw new Error('没有可读取的章节正文');
    let index = 0;
    for (const chapter of list) {
      index += 1;
      try {
        await this.profileChapter(run, chapter, index, list.length, { trackChapter: true });
      } catch (err) {
        if (isStop(err)) throw err;
        const title = chapter.chapter_title || `第 ${index} 章`;
        const message = err?.message || '失败';
        await this.noteFailure(run, 'assets', `${title} ${message}`);
        await this.pushLog(run, 'assets', `${title} 失败，跳过，继续下一章。${message}`);
      }
    }
  }

  async stepChapterProfiles(run) {
    const chapter = await this.ctx.model.Import.findByPk(run.import_id);
    if (!chapter || chapter.deleted_at || !String(chapter.body || '').trim()) {
      throw new Error('没有可读取的章节正文');
    }
    await this.profileChapter(run, chapter, 1, 1, { trackChapter: false });
  }

  async profileChapter(run, chapter, index, total, options = {}) {
    if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
    const project = await this.ctx.model.Project.findByPk(run.project_id);
    const title = chapter.chapter_title || `第 ${index} 章`;
    const message = `正在生成资产描述（${index}/${total}）${title}`;
    const patch = { message };
    if (options.trackChapter) {
      patch.import_id = chapter.id;
      patch.chapter_title = title;
      patch.current_node = 'assets';
    }
    await run.update(patch);
    if (options.trackChapter) {
      run.import_id = chapter.id;
      run.chapter_title = title;
    }
    run.message = message;
    const parts = splitBody(chapter.body);
    const style = await this.ctx.service.draft.styleContext(project, chapter);
    for (const part of parts) {
      if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
      try {
      const assets = await this.ctx.model.Asset.findAll({ where: { project_id: run.project_id } });
      const result = await invokeSkill(this.ctx, {
        skill: 'cartoon-asset-profile-skill',
        action: 'draft',
        signal: this.signal(this.signalKey(run)),
        payload: {
          chapter_title: title,
          body: part,
          known_assets: rosterText(assets),
            script_cast: scriptCast(chapter),
            visual_style_label: style?.visual_style_label || '',
            av_mode: topicsOf(project).includes('av'),
            topics: topicsOf(project),
        },
      });
      const output = result?.output || {};
      const characters = output.characters || output.state?.characters;
      const scenes = output.scenes || output.state?.scenes;
      if (output.done === false || !Array.isArray(characters) || !Array.isArray(scenes)) {
        throw new Error(`「${title}」没有返回资产描述`);
      }
      await this.applyProfiles(run, title, characters, scenes);
      await this.pulse(run, 'profile');
      } catch (err) {
        if (isStop(err)) throw err;
        const message = err?.message || '失败';
        await this.noteFailure(run, options.trackChapter ? 'assets' : 'profiles', `${title} ${message}`);
        await this.pushLog(run, options.trackChapter ? 'assets' : 'profiles', `${title} 这一段失败，跳过，继续下一段。${message}`);
      }
    }
    await this.pushLog(run, options.trackChapter ? 'assets' : 'profiles', `${title} 已读取`);
  }

  async applyProfiles(run, title, characters, scenes) {
    const assets = await this.ctx.model.Asset.findAll({ where: { project_id: run.project_id } });
    for (const item of characters) {
      const name = String(item?.name || '').trim();
      if (!name) continue;
      const found = assets.find(row => row.kind === 'character' && String(row.name || '').trim() === name);
      const costume = appendCostume(found?.costume_note, title, item.chapter_costume);
      if (found?.disabled) continue;
      if (found && this.assetFile(run.project_id, found.reference_path)) {
        if (costume !== String(found.costume_note || '')) await found.update({ costume_note: costume });
        continue;
      }
      const merged = mergeCharacter(found?.description, item);
      if (!found) {
        const created = await this.ctx.service.project.addAsset(run.project_id, {
          kind: 'character',
          name,
          description: merged.description,
          costume_note: costume,
        });
        assets.push(created);
        continue;
      }
      const patch = {};
      if (merged.changed) patch.description = merged.description;
      if (costume !== String(found.costume_note || '')) patch.costume_note = costume;
      if (Object.keys(patch).length) await found.update(patch);
    }
    for (const item of scenes) {
      const name = String(item?.name || '').trim();
      if (!name) continue;
      const found = assets.find(row => row.kind === 'scene' && String(row.name || '').trim() === name);
      if (found?.disabled) continue;
      if (found && this.assetFile(run.project_id, found.reference_path)) continue;
      const merged = mergeScene(found?.description, item);
      const sceneType = sceneTypeOf(item?.slots);
      if (!found) {
        if (!merged.description) continue;
        const created = await this.ctx.service.project.addAsset(run.project_id, {
          kind: 'scene',
          name,
          description: merged.description,
          scene_type: sceneType,
        });
        assets.push(created);
        continue;
      }
      const patch = {};
      if (merged.changed) patch.description = merged.description;
      if (sceneType && !String(found.scene_type || '').trim()) patch.scene_type = sceneType;
      if (Object.keys(patch).length) await found.update(patch);
    }
  }

  async stop(projectId, runId) {
    const where = { project_id: projectId, status: 'running' };
    if (runId) where.id = runId;
    const runs = await this.ctx.model.FullRun.findAll({ where });
    const notes = runs.filter(item => item.scope === 'note');
    const live = runs.filter(item => item.scope !== 'note');
    for (const run of notes) {
      await run.update({ status: 'stopped', message: '已停止' });
      await this.pushLog(run, run.current_node || 'script', '已停止');
    }
    if (!live.length) return { stopped: notes.length };
    cancelProject(this.app, projectId);
    for (const run of live) {
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
      if (run.scope === 'note') continue;
      const runId = run.id;
      setImmediate(() => {
        this.app.createAnonymousContext().service.fullAuto.walk(runId)
          .catch(err => this.app.logger.error('[cartoon] 全流程恢复失败 %s', err));
      });
    }
  }

  takeSeed(run) {
    if (!this.seedBags) this.seedBags = new Map();
    const key = run?.signal_key || `run:${run?.id || 0}`;
    if (!this.seedBags.has(key)) this.seedBags.set(key, new Set());
    return takeFreshSeed(this.seedBags.get(key));
  }

  async alive(run) {
    const fresh = await run.reload();
    return fresh.status === 'running';
  }

  async pulse(run, kind) {
    const { isDataKind } = require('../lib/dataPulse');
    if (!run || !isDataKind(kind) || !run.constructor?.rawAttributes?.data_seq) return;
    const seq = Number(run.data_seq || 0) + 1;
    await run.update({ data_kind: kind, data_seq: seq });
    run.data_kind = kind;
    run.data_seq = seq;
  }

  async pushLog(run, node, text) {
    if (!run?.constructor?.rawAttributes?.log) return;
    const log = parseJson(run.log, []);
    log.push({ at: new Date().toISOString(), node, text: String(text || '').slice(0, 500) });
    const trimmed = log.slice(-200);
    const raw = JSON.stringify(trimmed);
    await run.update({ log: raw });
    run.log = raw;
  }

  async reportSlice(run, key, text) {
    const note = String(text || '').slice(0, 500);
    await this.pushLog(run, key, note);
    const nodes = parseJson(run.nodes, blankNodes());
    const prev = nodes[key] || { status: 'running', note: '', started_at: '', failures: [] };
    nodes[key] = {
      status: 'running',
      note,
      started_at: prev.started_at || new Date().toISOString(),
      failures: Array.isArray(prev.failures) ? prev.failures : [],
    };
    const raw = JSON.stringify(nodes);
    await run.update({
      nodes: raw,
      current_node: key,
      message: note,
    });
    run.nodes = raw;
    run.current_node = key;
    run.message = note;
    if (key === 'storyboard') await this.pulse(run, 'storyboard');
  }

  async mark(run, key, status, note) {
    if (!run?.constructor?.rawAttributes?.nodes) return;
    const nodes = parseJson(run.nodes, blankNodes());
    const prev = nodes[key] || {};
    const noteText = note || '';
    const sameStep = status === 'running' && prev.status === 'running' && prev.note === noteText;
    const startedAt = status === 'running'
      ? (sameStep && prev.started_at ? prev.started_at : new Date().toISOString())
      : (prev.started_at || '');
    const failures = Array.isArray(prev.failures) ? prev.failures : [];
    nodes[key] = { status, note: noteText, started_at: startedAt, failures };
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

  async noteFailure(run, key, message) {
    if (!run?.constructor?.rawAttributes?.nodes) return 0;
    const count = Number(run.fail_count || 0) + 1;
    const nodes = parseJson(run.nodes, blankNodes());
    const prev = nodes[key] || { status: 'pending', note: '', started_at: '' };
    const failures = Array.isArray(prev.failures) ? prev.failures.slice() : [];
    failures.push({
      at: new Date().toISOString(),
      count,
      message: String(message || '失败').slice(0, 500),
    });
    nodes[key] = {
      status: prev.status || 'running',
      note: prev.note || '',
      started_at: prev.started_at || '',
      failures,
    };
    const raw = JSON.stringify(nodes);
    await run.update({ fail_count: count, nodes: raw });
    run.fail_count = count;
    run.nodes = raw;
    return count;
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
      await this.noteFailure(run, key, message);
      await this.mark(run, key, 'failed', message);
      await this.pushLog(run, key, `${NODE_LABEL[key]}失败：${message}。跳过这一步，继续后面的步骤。`);
      this.ctx.logger.warn('[cartoon] full-auto %s %s %s', run.id, key, message);
      return true;
    }
  }

  async walk(runId) {
    const busy = this.walking();
    if (busy.has(runId)) return;
    busy.add(runId);
    const run = await this.ctx.model.FullRun.findByPk(runId);
    if (!run || run.status !== 'running' || run.scope === 'note') {
      busy.delete(runId);
      return;
    }
    this.bindRunLlm(run);
    const modelText = this.modelLine(run);
    if (modelText && !parseJson(run.log, []).some(line => String(line?.text || '').startsWith('本次模型'))) {
      await this.pushLog(run, run.current_node || 'script', modelText);
    }
    try {
      if (run.scope === 'profiles') {
        try {
          await this.stepProfiles(run);
          if (await this.alive(run)) {
            await run.update({ status: 'success', current_node: 'done', message: '资产描述已写入', error_message: '' });
            await this.pushLog(run, 'assets', '资产描述已写入');
          }
        } catch (err) {
          if (isStop(err) || !await this.alive(run)) {
            if (run.status === 'running') await run.update({ status: 'stopped', message: '已停止' });
          } else {
            const message = err?.message || '失败';
            await this.noteFailure(run, 'assets', message);
            await this.mark(run, 'assets', 'failed', message);
            await run.update({ status: 'exception', current_node: 'done', message: '资产描述已走完，有章节失败已跳过', error_message: '' });
            await this.pushLog(run, 'assets', `资产描述失败：${message}。已跳过并结束这一轮。`);
          }
        }
        return;
      }
      const steps = run.scope === 'assets' || run.scope === 'assets-reset'
        ? [ [ 'assets', () => this.stepAssets(run) ] ]
        : [
          [ 'script', () => this.stepScript(run) ],
          [ 'profiles', () => this.stepChapterProfiles(run) ],
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
        const assetRun = run.scope === 'assets' || run.scope === 'assets-reset';
        const nodes = parseJson(run.nodes, {});
        const hadFault = this.hadFault(nodes);
        const done = assetRun
          ? (run.scope === 'assets-reset' ? '设定图已重绘' : '资产已生成')
          : '全流程已完成';
        const message = hadFault ? `${done}，有单条失败已跳过` : done;
        await run.update({ status: hadFault ? 'exception' : 'success', current_node: 'done', message, error_message: '' });
        await this.pushLog(run, assetRun ? 'assets' : 'video', message);
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
      const source = String(current.body || '');
      const settled = settleScript(current.script_data, source, 0);
      if (settled.issues.length) {
        throw new Error(`已有剧本还不能往下做。${settled.issues.slice(0, 3).join('；')}。请重新生成剧本`);
      }
      await this.pushLog(run, 'script', `已有剧本，${existing.length} 场`);
      return;
    }
    await this.ctx.service.draft.suggestScript(run.project_id, run.import_id);
    const chapter = await this.ctx.model.Import.findByPk(run.import_id);
    const scenes = chapter?.script_data?.scenes;
    if (!Array.isArray(scenes) || !scenes.length) throw new Error('剧本没有场次');
    await this.pushLog(run, 'script', `剧本已写入，${scenes.length} 场`);
    await this.pulse(run, 'script');
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
      item.look = briefLook(item.look);
      item.note = item.look
        ? ''
        : '没有明确外形。按性别、年龄、身高、体态、脸型、眉眼、鼻唇、发型、肤色、服装各写一句。不要抄章节或剧本原文，不要写情节。';
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
    const reset = run.scope === 'assets-reset';
    for (const item of this.sheetPlan(chapter)) {
      if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
      try {
        await this.ensureSheet(run, chapter, style, item, { reset, project });
      } catch (err) {
        if (isStop(err)) throw err;
        const label = `${item.kind === 'scene' ? '场景' : '人物'}「${item.name}」`;
        const message = err?.message || '失败';
        await this.noteFailure(run, 'assets', `${label} ${message}`);
        await this.pushLog(run, 'assets', `${label} 失败，跳过，继续下一项。${message}`);
      }
    }
  }

  async copySheetToRefmod(run, asset, bytes, reset) {
    let data = bytes;
    if (!data) {
      const absolute = this.assetFile(run.project_id, asset.reference_path);
      if (!absolute) return;
      data = fs.readFileSync(absolute);
    }
    await this.ctx.service.refmod.storeSheet(run.project_id, asset, data, { reset });
  }

  async ensureSheet(run, chapter, style, item, options = {}) {
    const assets = await this.ctx.model.Asset.findAll({
      where: { project_id: run.project_id, kind: item.kind, disabled: false },
    });
    let asset = assets.find(row => String(row.name || '').trim() === item.name);
    const description = assetText(item);
    const stored = String(asset?.description || '').trim();
    const look = item.kind === 'character' && stored ? stored : item.look;
    const note = item.kind === 'character' && stored ? '' : item.note;
    const project = options.project || await this.ctx.model.Project.findByPk(run.project_id);
    const avNude = item.kind === 'character'
      && Boolean(project?.av_mode)
      && adultAge([ look, note, stored, asset?.costume_note ].join('\n'));
    const hasSheet = asset && this.assetFile(run.project_id, asset.reference_path);
    if (hasSheet && !options.reset) {
      if (description && !String(asset.description || '').trim()) await asset.update({ description });
      await this.copySheetToRefmod(run, asset, null, false);
      await this.pushLog(run, options.quiet ? 'video' : 'assets', `${item.kind === 'scene' ? '场景' : '人物'}「${item.name}」已有设定图`);
      return;
    }
    if (!options.quiet) {
      await this.mark(run, 'assets', 'running', `正在生成${item.kind === 'scene' ? '场景' : '人物'}「${item.name}」`);
    }
    const result = await invokeSkill(this.ctx, {
      skill: 'cartoon-asset-sheet-skill',
      action: 'draft',
      signal: this.signal(this.signalKey(run)),
      payload: {
        kind: item.kind,
        name: item.name,
        look,
        note,
        visual_style_label: style?.visual_style_label || '',
        visual_style_prompt: style?.visual_style_prompt || '',
        sparse: Boolean(item.sparse),
        av_nude: avNude,
      },
    });
    let prompt = polishSheetPrompt(sheetPrompt(result));
    if (!prompt) throw new Error(`没有返回「${item.name}」的设定图提示词`);
    if (item.kind === 'character') {
      const lead = this.frameStyleLead(style, prompt);
      if (lead) {
        prompt = `${lead}\n${prompt}`;
        await this.pushLog(run, options.quiet ? 'video' : 'assets', `人物「${item.name}」设定图带上项目风格「${style?.visual_style_label || '未命名'}」`);
      }
      if (avNude && !prompt.includes('禁止非全裸')) {
        prompt = `${prompt}\n${NUDE_LINE}`;
        await this.pushLog(run, options.quiet ? 'video' : 'assets', `人物「${item.name}」设定图按全裸绘制`);
      } else if (project?.av_mode && !avNude) {
        await this.pushLog(run, options.quiet ? 'video' : 'assets', `人物「${item.name}」未确认满二十一岁，设定图不写全裸`);
      }
    }
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
    if (options.reset || (prompt && !String(asset.consistency_note || '').trim())) patch.consistency_note = prompt;
    await asset.update(patch);
    await this.copySheetToRefmod(run, asset, file, Boolean(options.reset));
    await this.pushLog(run, options.quiet ? 'video' : 'assets', `${item.kind === 'scene' ? '场景' : '人物'}「${item.name}」已生成一张设定总图`);
    await this.pulse(run, 'asset');
  }

  sceneLabel(script, shot) {
    return sceneTitle(script, shot);
  }

  sharesScene(left, right) {
    const a = sceneKey(left);
    const b = sceneKey(right);
    return Boolean(a && a === b);
  }

  async taskChainIndex(projectId, shot, prev, startedAt, nth) {
    const step = Number.isInteger(nth) && nth >= 0 ? nth : 0;
    const ownPrior = startedAt
      ? ((await this.videoShotCounts(projectId, [ shot.id ], { before: startedAt })).get(Number(shot.id)) || 0)
      : 0;
    const plantIndex = ownPrior + step;
    if (!prev || !this.sharesScene(shot, prev)) return { plantIndex, tailIndex: plantIndex };
    const prevPrior = startedAt
      ? ((await this.videoShotCounts(projectId, [ prev.id ], { before: startedAt })).get(Number(prev.id)) || 0)
      : 0;
    return { plantIndex, tailIndex: prevPrior + step };
  }

  async renderSheet(run, prompt) {
    if (!Number(run.asset_workflow_id)) throw new Error('还没有设定图，无法继续出图');
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
      seed: this.takeSeed(run),
      signal: this.signal(this.signalKey(run)),
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
    for (let index = 0; index < shots.length; index += 1) {
      if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
      const shot = shots[index];
      try {
        await this.fillShotPrompt(run, shot, {
          force: Boolean(run.fresh),
          index,
          total: shots.length,
        });
      } catch (err) {
        if (isStop(err)) throw err;
        const code = shot.shot_code || shot.id;
        const message = err?.message || '失败';
        await this.noteFailure(run, 'prompts', `${code} ${message}`);
        await this.pushLog(run, 'prompts', `${code} 提示词失败，跳过这一镜，继续下一镜。${message}`);
      }
    }
  }

  promptReady(row) {
    return Boolean(row
      && String(row.positive_zh || '').trim()
      && String(row.frame_start_zh || '').trim()
      && String(row.frame_end_zh || '').trim());
  }

  async fillShotPrompt(run, shot, options = {}) {
    const code = shot.shot_code || shot.id;
    const existing = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
    const writtenAt = new Date(existing?.updated_at || existing?.updatedAt || 0).getTime();
    const startedAt = new Date(run?.created_at || run?.createdAt || 0).getTime();
    const writtenThisRun = options.force && this.promptReady(existing) && writtenAt && startedAt && writtenAt >= startedAt;
    if (this.promptReady(existing) && (!options.force || writtenThisRun)) {
      if (!options.quiet) await this.pushLog(run, 'prompts', `${code} 已有提示词`);
      return existing;
    }
    if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
    const place = options.total ? `（${Number(options.index) + 1}/${options.total}）` : '';
    await this.mark(run, 'prompts', 'running', `正在生成提示词${place} ${code}`);
    await this.ctx.service.draft.expandShot(run.project_id, run.import_id, { shot_id: shot.id });
    const saved = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
    if (this.promptReady(saved)) {
      await this.pushLog(run, 'prompts', `${code} 已写入视频、首帧、尾帧提示词`);
      await this.pulse(run, 'prompt');
      return saved;
    }
    throw new Error(`${code} 没有写全提示词`);
  }

  async stepWorkflow(run) {
    await this.ctx.model.Shot.update(
      { workflow_id: run.video_workflow_id },
      { where: { project_id: run.project_id, import_id: run.import_id } },
    );
    await this.pushLog(run, 'workflow', `每镜使用 ${run.video_workflow_name}`);
    await this.pulse(run, 'workflow');
  }

  async videoShotCounts(projectId, shotIds, options = {}) {
    const ids = (shotIds || []).map(id => Number(id)).filter(id => id > 0);
    const counts = new Map();
    if (!ids.length) return counts;
    const where = {
      project_id: projectId,
      shot_id: ids,
      status: 'success',
      kind: VIDEO_KINDS,
    };
    if (options.since) where.created_at = { [Op.gte]: options.since };
    else if (options.before) where.created_at = { [Op.lt]: options.before };
    const tasks = await this.ctx.model.Task.findAll({ where });
    if (!tasks.length) return counts;
    const outputs = await this.ctx.model.Output.findAll({
      where: { task_id: tasks.map(item => item.id), media_kind: 'video' },
    });
    const readyTasks = new Set(outputs.filter(item => item.file_path).map(item => Number(item.task_id)));
    tasks.forEach(task => {
      if (!readyTasks.has(Number(task.id))) return;
      const id = Number(task.shot_id);
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    return counts;
  }

  async videoShotIds(projectId, shotIds) {
    const counts = await this.videoShotCounts(projectId, shotIds);
    return new Set([ ...counts.keys() ]);
  }

  async dropFreshFrames(run, shot) {
    const dir = resolveInside(outputRoot(this.app), `frames/${run.project_id}/${shot.id}`);
    if (dir && fs.existsSync(dir)) {
      const names = await fs.promises.readdir(dir);
      await Promise.all(names
        .filter(name => name === 'manual.png' || name === 'end.png')
        .map(name => fs.promises.unlink(path.join(dir, name)).catch(() => {})));
    }
    if (shot.manual_frame_path) await shot.update({ manual_frame_path: '' });
  }

  async stepVideo(run) {
    const shots = await this.shotsOf(run);
    const chapter = await this.ctx.model.Import.findByPk(run.import_id);
    const script = chapter?.script_data || {};
    const done = new Set(parseJson(run.done_shot_ids, []).map(id => Number(id)));
    await run.update({ video_total: shots.length, video_done: done.size });
    const want = videoCount(run.video_count);
    const since = run.fresh ? (run.created_at || run.createdAt || null) : null;
    const countOptions = since ? { since } : {};
    const readyCounts = await this.videoShotCounts(run.project_id, shots.map(item => item.id), countOptions);
    const videoChoice = await this.ctx.service.generate.choiceById(run.video_workflow_id);
    const wantEnd = run.generate_end !== false;
    const endSlot = (videoChoice.images || []).find(slot => slot.role === 'end');
    const startSlot = (videoChoice.images || []).find(slot => slot.role === 'start') || null;
    if (wantEnd && !endSlot) throw new Error('满血首尾帧工作流没有尾帧入口');
    let previousKey = '';
    for (let index = 0; index < shots.length; index += 1) {
      const shot = await this.ctx.model.Shot.findByPk(shots[index].id);
      if (!shot) {
        await this.pushLog(run, 'video', '有一条镜头已不在项目里，跳过，继续下一镜');
        continue;
      }
      const scene = sceneTitle(script, shot);
      const key = sceneKey(shot);
      const same = index > 0 && key && key === previousKey;
      previousKey = key || previousKey;
      if (done.has(shot.id)) continue;
      const code = shot.shot_code || shot.id;
      const have = readyCounts.get(Number(shot.id)) || 0;
      const startedAt = run.created_at || run.createdAt || null;
      const prior = !run.fresh && startedAt
        ? ((await this.videoShotCounts(run.project_id, [ shot.id ], { before: startedAt })).get(Number(shot.id)) || 0)
        : (run.fresh ? 0 : have);
      const during = !run.fresh && startedAt
        ? ((await this.videoShotCounts(run.project_id, [ shot.id ], { since: startedAt })).get(Number(shot.id)) || 0)
        : (run.fresh ? have : 0);
      const missing = run.fresh ? Math.max(0, want - have) : Math.max(0, want - during);
      if (!missing) {
        await this.pushLog(run, 'video', run.fresh ? `${code} 已有 ${have} 条视频` : `${code} 本轮已有 ${during} 条视频`);
        done.add(shot.id);
        const raw = JSON.stringify([ ...done ]);
        await run.update({ done_shot_ids: raw, video_done: done.size });
        run.done_shot_ids = raw;
        continue;
      }
      if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
      try {
        const live = run.fresh ? await this.ctx.model.Task.findOne({
          where: {
            project_id: run.project_id,
            shot_id: shot.id,
            kind: VIDEO_KINDS,
            status: [ 'queued', 'running', 'saving' ],
            ...(since ? { created_at: { [Op.gte]: since } } : {}),
          },
        }) : null;
        if (run.fresh && !have && !live) await this.dropFreshFrames(run, shot);
        if (run.fresh) {
          let guard = 0;
          while (guard < want) {
            if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
            const haveNow = (await this.videoShotCounts(run.project_id, [ shot.id ], countOptions)).get(Number(shot.id)) || 0;
            if (haveNow >= want) break;
            guard += 1;
            const prevShot = await this.previousShot(shot);
            const chain = await this.taskChainIndex(run.project_id, shot, prevShot, startedAt, haveNow);
            await this.mark(run, 'video', 'running', `正在生成镜头 ${code} 第 ${haveNow + 1}/${want} 条（${index + 1}/${shots.length}）`);
            await this.shoot(run, shot, endSlot, same, scene, {
              batchIndex: chain.plantIndex,
              tailIndex: chain.tailIndex,
              wantEnd,
              startSlot,
            });
          }
          const haveAfter = (await this.videoShotCounts(run.project_id, [ shot.id ], countOptions)).get(Number(shot.id)) || 0;
          if (haveAfter < want) {
            await this.pushLog(run, 'video', `${code} 这一轮已有 ${haveAfter} 条，还没凑满 ${want} 条`);
            continue;
          }
        } else {
          for (let nth = 0; nth < missing; nth += 1) {
            if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
            const batchIndex = prior + during + nth;
            await this.mark(run, 'video', 'running', `正在生成镜头 ${code} 本轮第 ${during + nth + 1}/${want} 条（${index + 1}/${shots.length}）`);
            await this.shoot(run, shot, endSlot, same, scene, {
              batchIndex,
              wantEnd,
              startSlot,
            });
          }
        }
        done.add(shot.id);
        const raw = JSON.stringify([ ...done ]);
        await run.update({ done_shot_ids: raw, video_done: done.size });
        run.done_shot_ids = raw;
        await this.pushLog(run, 'video', want > 1 ? `${code} 已生成 ${want} 条视频` : `${code} 视频已生成`);
        await this.pulse(run, 'video');
      } catch (err) {
        if (isStop(err) || !await this.alive(run)) throw err;
        const message = err?.message || '失败';
        await this.noteFailure(run, 'video', `${code} ${message}`);
        await this.pushLog(run, 'video', `${code} 视频失败，跳过这一镜，继续下一镜。${message}`);
      }
    }
  }

  async shoot(run, shot, endSlot, sameScene, scene, options = {}) {
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
    const prompt = await this.fillShotPrompt(run, shot, { quiet: true });
    const videoText = String(prompt?.positive_zh || '').trim();
    const frameStart = String(prompt?.frame_start_zh || '').trim();
    const frameEnd = String(prompt?.frame_end_zh || '').trim();
    const negative = String(prompt?.negative_zh || '').trim();
    const code = shot.shot_code || shot.id;
    const wantEnd = options.wantEnd !== false;
    const batchIndex = Number.isInteger(options.batchIndex) ? options.batchIndex : 0;
    const tailIndex = Number.isInteger(options.tailIndex) ? options.tailIndex : batchIndex;
    const startHeld = await this.ensureStartFrame(run, shot, sameScene, scene, videoText, frameStart, frameEnd, negative, {
      batchIndex: tailIndex,
      chain: sameScene,
    });
    const endHeld = wantEnd
      ? await this.ensureEndFrame(run, shot, videoText, frameStart, frameEnd, negative, { batchIndex, regen: true })
      : null;
    if (!startHeld?.bytes) throw new Error(`${code} 首帧没有生成`);
    if (wantEnd && !endHeld?.bytes) throw new Error(`${code} 尾帧没有生成`);
    if (startHeld.ephemeral && !options.startSlot) throw new Error(`${code} 首帧没有入口`);
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
        duration_sec: (() => {
          const covered = promptCoveredMs(videoText);
          const proposed = covered ? covered / 1000 : (shot.duration_ms ? shot.duration_ms / 1000 : 10);
          return fitDurationSec(proposed, shot.dialogue, proposed);
        })(),
        seed: this.takeSeed(run),
        ephemeral_refmod_id: packId,
        generate_end: wantEnd,
        chain_batch: batchIndex,
        chain_tail: tailIndex,
        frame_tasks: {
          start_task_id: startHeld.taskId || null,
          end_task_id: endHeld?.taskId || null,
        },
        images: [
          ...(startHeld.ephemeral ? [{
            id: options.startSlot.id,
            slot_id: options.startSlot.id,
            filename: 'first.png',
            data_base64: startHeld.bytes.toString('base64'),
            label: '首帧',
            persist: false,
          }] : []),
          ...(wantEnd && endSlot ? [{
            id: endSlot.id,
            slot_id: endSlot.id,
            filename: 'end.png',
            data_base64: endHeld.bytes.toString('base64'),
            label: '尾帧',
          }] : []),
        ],
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

  sceneTail(projectId, shotId, batchIndex) {
    const batch = Number.isInteger(batchIndex) ? batchIndex : 0;
    const relatives = [
      `frames/${projectId}/${shotId}/b${batch}-end.png`,
      `frames/${projectId}/${shotId}/b${batch}-last.png`,
    ];
    for (const relative of relatives) {
      const absolute = this.frameAbsolute(relative);
      if (absolute) return absolute;
    }
    return null;
  }

  frameAbsolute(relative) {
    if (!relative) return null;
    const absolute = resolveInside(outputRoot(this.app), String(relative).split('?')[0]);
    if (!absolute || !fs.existsSync(absolute)) return null;
    return absolute;
  }

  async adoptPreviousEnd(shot, batchIndex) {
    if (!Number.isInteger(batchIndex) || batchIndex < 0) return false;
    const prev = await this.previousShot(shot);
    if (!prev) return false;
    if (!sceneKey(shot) || sceneKey(shot) !== sceneKey(prev)) return false;
    const planted = this.sceneTail(shot.project_id, prev.id, batchIndex);
    if (!planted) return false;
    const relative = `frames/${shot.project_id}/${shot.id}/b${batchIndex}-from-prev.png`;
    const absolute = resolveInside(outputRoot(this.app), relative);
    if (!absolute) return false;
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    await fs.promises.copyFile(planted, absolute);
    await shot.update({ manual_frame_path: relative });
    return true;
  }

  async previousShot(shot) {
    return this.ctx.model.Shot.findOne({
      where: {
        project_id: shot.project_id,
        import_id: shot.import_id || null,
        [Op.or]: [
          { sort_order: { [Op.lt]: shot.sort_order } },
          { sort_order: shot.sort_order, id: { [Op.lt]: shot.id } },
        ],
      },
      order: [[ 'sort_order', 'DESC' ], [ 'id', 'DESC' ]],
    });
  }

  async ensureStartFrame(run, shot, sameScene, scene, videoText, frameStart, frameEnd, negative, options = {}) {
    const fresh = await shot.reload();
    const code = shot.shot_code || shot.id;
    const batchIndex = Number.isInteger(options.batchIndex) ? options.batchIndex : 0;
    const manual = this.frameAbsolute(fresh.manual_frame_path);
    if (manual) {
      await this.pushLog(run, 'video', `${code} 使用指定首帧`);
      return { bytes: fs.readFileSync(manual), taskId: null, ephemeral: false };
    }
    const prev = (sameScene || options.chain) ? await this.previousShot(fresh) : null;
    const same = Boolean(prev) && sceneKey(fresh) && sceneKey(fresh) === sceneKey(prev);
    if (same) {
      const planted = this.sceneTail(run.project_id, prev.id, batchIndex);
      if (planted) {
        await this.pushLog(run, 'video', `${code} 使用第 ${batchIndex + 1} 条上镜尾帧`);
        return { bytes: fs.readFileSync(planted), taskId: null, ephemeral: false };
      }
      await this.pushLog(run, 'video', `${code} 没有第 ${batchIndex + 1} 条上镜尾帧，生成这一条的首帧`);
      const rendered = await this.renderFrame(run, shot, 'start', videoText, frameStart, frameEnd, negative);
      return { ...rendered, ephemeral: true };
    }
    const carried = this.frameAbsolute(fresh.first_frame_path);
    if (carried) {
      await this.pushLog(run, 'video', `${code} 没有指定首帧，使用上镜尾帧`);
      return { bytes: fs.readFileSync(carried), taskId: null, ephemeral: false };
    }
    await this.pushLog(run, 'video', `${code} 没有指定首帧和上镜尾帧，生成首帧`);
    const rendered = await this.renderFrame(run, shot, 'start', videoText, frameStart, frameEnd, negative);
    await this.ctx.service.project.saveManualFrame(run.project_id, shot.id, {
      filename: 'manual.png',
      data_base64: rendered.bytes.toString('base64'),
    });
    return { ...rendered, ephemeral: false };
  }

  async ensureEndFrame(run, shot, videoText, frameStart, frameEnd, negative, options = {}) {
    const code = shot.shot_code || shot.id;
    const batchIndex = Number.isInteger(options.batchIndex) ? options.batchIndex : null;
    const relative = batchIndex == null
      ? `frames/${run.project_id}/${shot.id}/end.png`
      : `frames/${run.project_id}/${shot.id}/b${batchIndex}-end.png`;
    if (!options.regen) {
      const existing = this.frameAbsolute(relative);
      if (existing) {
        await this.pushLog(run, 'video', `${code} 已有尾帧`);
        return { bytes: fs.readFileSync(existing), taskId: null };
      }
    }
    await this.pushLog(run, 'video', `${code} 生成尾帧`);
    const rendered = await this.renderFrame(run, shot, 'end', videoText, frameStart, frameEnd, negative);
    const absolute = resolveInside(outputRoot(this.app), relative);
    if (!absolute) throw new Error(`${code} 尾帧路径无效`);
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    await fs.promises.writeFile(absolute, rendered.bytes);
    return rendered;
  }

  frameStyleLead(style, frameText) {
    const text = String(frameText || '');
    const label = String(style?.visual_style_label || '').trim();
    const prompt = String(style?.visual_style_prompt || '').trim();
    const lines = [];
    if (label && !text.includes(label)) lines.push(`画面风格：${label}`);
    if (prompt && !text.includes(prompt)) lines.push(prompt);
    return lines.join('\n');
  }

  async renderFrame(run, shot, target, videoText, frameStart, frameEnd, negative) {
    const choice = await this.ctx.service.generate.choiceById(run.frame_workflow_id);
    const frameText = target === 'end' ? frameEnd : frameStart;
    const images = await this.frameReferenceImages(run, shot, choice, target, frameText);
    const project = await this.ctx.model.Project.findByPk(run.project_id);
    const chapter = await this.ctx.model.Import.findByPk(run.import_id);
    const style = await this.ctx.service.draft.styleContext(project, chapter);
    const lead = this.frameStyleLead(style, frameText);
    const code = shot.shot_code || shot.id;
    const label = target === 'end' ? '尾帧' : '首帧';
    if (lead) await this.pushLog(run, 'video', `${code} ${label}带上项目风格「${style?.visual_style_label || '未命名'}」`);
    let task = await this.ctx.service.generate.start(run.project_id, shot.id, {
      positive_zh: videoText,
      frame_start_zh: frameStart,
      frame_end_zh: frameEnd,
      negative_zh: negative,
      workflow_id: run.frame_workflow_id,
      frame_target: target,
      seed: this.takeSeed(run),
      asset_ids: [],
      images,
      lead_zh: lead,
      width: run.frame_width,
      height: run.frame_height,
    }, 'image');
    if (task?.id) await this.track(run, task.id);
    if ([ 'queued', 'running', 'saving' ].includes(task?.status)) task = await this.awaitTask(run, task);
    if (!task || task.status !== 'success') {
      throw new Error(task?.error_message || `${shot.shot_code || shot.id} ${target === 'end' ? '尾帧' : '首帧'}没有生成`);
    }
    return { bytes: await this.readOutput(task.id), taskId: task.id };
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

  async frameReferenceImages(run, shot, choice, target, frameText) {
    const slots = this.referenceSlots(choice);
    const cap = this.referenceCap(choice);
    if (!cap || !/图生图/.test(choice?.name || '')) return [];
    const files = await this.shotSheetFiles(run, shot, cap, frameText);
    const code = shot.shot_code || shot.id;
    if (!files.length) throw new Error(`${code} 图生图首尾帧需要这一镜的人物或场景设定图`);
    const label = target === 'end' ? '尾帧' : '首帧';
    await this.pushLog(run, 'video', `${code} ${label}参考 ${files.map(file => file.label).join('、')}（最多 ${cap} 张）`);
    const slot = slots[0];
    const batch = files.map((file, index) => ({
      filename: `ref-${index + 1}${file.ext || '.png'}`,
      data_base64: file.bytes.toString('base64'),
      label: file.label,
    }));
    if (slot.expand || slots.length === 1) {
      return [{ id: slot.id, slot_id: slot.id, files: batch }];
    }
    return batch.map((file, index) => ({
      id: slots[index].id,
      slot_id: slots[index].id,
      filename: file.filename,
      data_base64: file.data_base64,
      label: file.label,
    }));
  }

  async shotSheetFiles(run, shot, cap, focusText) {
    const prompt = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
    const blob = [ shot.description, shot.dialogue, prompt?.positive_zh, prompt?.frame_start_zh, prompt?.frame_end_zh ].filter(Boolean).join('\n');
    const focus = String(focusText || '').trim();
    const chapter = await this.ctx.model.Import.findByPk(run.import_id);
    const project = await this.ctx.model.Project.findByPk(run.project_id);
    const style = await this.ctx.service.draft.styleContext(project, chapter);
    const matched = this.sheetPlan(chapter)
      .filter(item => blob.includes(item.name))
      .sort((a, b) => b.name.length - a.name.length)
      .filter((item, index, list) => !list.slice(0, index).some(kept => kept.name.includes(item.name)));
    for (const item of matched) {
      if (!await this.alive(run)) throw Object.assign(new Error('已停止'), { stop: true });
      await this.ensureSheet(run, chapter, style, item, { quiet: true, project });
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
    const namedCharacters = (focus
      ? characterFiles.filter(file => file.name && focus.includes(file.name))
      : characterFiles)
      .filter((file, _index, list) => !list.some(other => other !== file && other.name.length > file.name.length && other.name.includes(file.name)));
    const skipped = characterFiles.filter(file => !namedCharacters.includes(file));
    if (skipped.length) {
      await this.pushLog(run, 'video', `${shot.shot_code || shot.id} 这一帧没有点名 ${skipped.map(file => file.label).join('、')}，不送这些人物参考`);
    }
    const namedScenes = focus ? sceneFiles.filter(file => file.name && focus.includes(file.name)) : sceneFiles;
    const sceneFile = namedScenes.find(file => sceneLabel && file.name === sceneLabel)
      || namedScenes[0]
      || sceneFiles.find(file => sceneLabel && file.name === sceneLabel)
      || null;
    const characterCap = sceneFile && cap > 1 ? cap - 1 : cap;
    const files = namedCharacters.slice(0, characterCap);
    if (sceneFile && files.length < cap) files.push(sceneFile);
    if (namedCharacters.length > characterCap) {
      await this.pushLog(run, 'video', `${shot.shot_code || shot.id} 这一帧的人物设定图超过 ${characterCap} 张，场景参考另占最后一格`);
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
    const { startMediaWatch } = require('../lib/executionTrace');
    const watch = await startMediaWatch(this.ctx, task);
    const started = Date.now();
    try {
      const fresh = await this.awaitTaskBody(run, task);
      const state = !fresh
        ? 'error'
        : (fresh.status === 'success' ? 'ok' : (fresh.status === 'cancelled' ? 'skip' : 'error'));
      await watch.close(state, fresh?.error_message || '', Date.now() - started);
      return fresh;
    } catch (err) {
      await watch.close(err?.stop ? 'skip' : 'error', err?.message || '失败', Date.now() - started);
      throw err;
    }
  }

  async awaitTaskBody(run, task) {
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
      await sleep(3000, this.signal(this.signalKey(run)));
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
