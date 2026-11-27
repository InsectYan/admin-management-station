'use strict';

const Service = require('egg').Service;
const { invokeSkill, recordPromptMemory } = require('../lib/agentProxy');
const { clientAbort, stopError } = require('../lib/clientAbort');
const { productionInput } = require('../lib/productionInput');
const {
  composeProjectStyle,
  detectXianxia,
  normalizeShotSizes,
  serializeShotSizes,
  normalizeCameraMoves,
  serializeCameraMoves,
} = require('../lib/cartoonMeta');
const { normalizeOmissions, uncoveredParagraphs, skipExcuse } = require('../lib/storyCoverage');
const { settleScript } = require('../lib/scriptGate');
const { normalizeScript, placeTag } = require('../lib/rosterNames');
const { uniquePrompt } = require('../lib/promptText');
const { promptCoveredMs, fitDurationSec } = require('../lib/promptDuration');
const { topicsOf, TOPIC_OPTIONS } = require('../lib/topics');
const { assetFactText, namedAssets } = require('../lib/assetProfile');
const { chapterParagraphs, resolveExcerpt, matchExcerpt } = require('../lib/sourceExcerpt');
const { begin, finish } = require('../lib/activeRuns');
const { openRun, closeRun, noteStep } = require('../lib/executionTrace');

function outputOf(result) {
  return result?.output || {};
}

function lostParagraphOmission(sceneIndex, paragraphs, shots) {
  const missing = uncoveredParagraphs(paragraphs, shots);
  if (!missing.length) return null;
  const texts = new Map((paragraphs || []).map(item => [ Number(item.index), String(item.text || '') ]));
  const shown = missing.slice(0, 6).map(index => {
    const text = String(texts.get(index) || '').replace(/\s+/g, ' ').trim();
    const clip = text.length > 42 ? `${text.slice(0, 42)}…` : text;
    return clip ? `第${index}段「${clip}」` : `第${index}段`;
  });
  const tail = missing.length > shown.length ? `，另有 ${missing.length - shown.length} 段` : '';
  return {
    target: `第${sceneIndex}场`,
    notice: '分镜跳过',
    reason: `这些原文没有拆成镜头：${shown.join('、')}${tail}`,
  };
}

function anchorOf(paragraphs, hint) {
  const text = String(hint || '').trim();
  if (text.length < 6) return -1;
  const direct = paragraphs.findIndex(item => item.includes(text));
  if (direct >= 0) return direct;
  const piece = text.replace(/\s/g, '').slice(0, 12);
  if (piece.length < 6) return -1;
  return paragraphs.findIndex(item => item.includes(piece));
}

/** 一场的原文是从它的起始句到下一场起始句之前。 */
function sceneSpans(script, body) {
  const paragraphs = chapterParagraphs(body);
  const scenes = Array.isArray(script?.scenes) ? script.scenes : [];
  const anchors = scenes.map(scene => anchorOf(paragraphs, scene?.source_start));
  return scenes.map((scene, index) => {
    const from = anchors[index];
    const base = {
      scene_index: index + 1,
      title: String(scene?.title || ''),
      summary: String(scene?.summary || ''),
      wardrobe: String(scene?.wardrobe || ''),
      source_start: String(scene?.source_start || ''),
    };
    if (from < 0) return { ...base, paragraphs: [] };
    let to = paragraphs.length - 1;
    for (let next = index + 1; next < anchors.length; next += 1) {
      if (anchors[next] > from) {
        to = anchors[next] - 1;
        break;
      }
    }
    if (to < from) to = from;
    return {
      ...base,
      paragraphs: paragraphs.slice(from, to + 1).map((text, offset) => ({
        index: from + offset + 1,
        text,
      })),
    };
  });
}

function sceneTitle(scriptData, item) {
  const scenes = Array.isArray(scriptData?.scenes) ? scriptData.scenes : [];
  const index = Number(item?.scene_index);
  if (!Number.isInteger(index) || index < 1 || index > scenes.length) return '';
  return placeTag(scenes[index - 1]?.title || scenes[index - 1]?.name || '').slice(0, 200);
}

function picturePrompt(text) {
  return uniquePrompt(text);
}

function wardrobeText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return '';
  const uniform = String(value.uniform || value.base || '').trim();
  const state = String(value.state || value.status || '').trim();
  const lines = [];
  if (uniform) lines.push(uniform.startsWith('服装统一') ? uniform : `服装统一：${uniform}`);
  if (state) lines.push(state.startsWith('状态') ? state : `状态：${state}`);
  return lines.join('\n');
}

function sceneWardrobe(script, sceneIndex, sceneLabel) {
  const scenes = Array.isArray(script?.scenes) ? script.scenes : [];
  const index = Number(sceneIndex);
  if (Number.isInteger(index) && index > 0 && scenes[index - 1]) {
    const text = wardrobeText(scenes[index - 1].wardrobe);
    if (text) return text;
  }
  const label = String(sceneLabel || '').trim();
  if (!label) return '';
  const hit = scenes.find(scene => {
    const title = String(scene?.title || '').trim();
    return title && label.includes(title);
  });
  return wardrobeText(hit?.wardrobe);
}

function clipText(text, max = 6000) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function clipSpan(text, head = 1200, tail = 1800) {
  const value = String(text || '').trim();
  if (value.length <= head + tail) return value;
  return `${value.slice(0, head)}……${value.slice(value.length - tail)}`;
}

function skillRaw(result) {
  const steps = Array.isArray(result?.output?.steps) ? result.output.steps : [];
  return steps.map(item => String(item?.rawText || '').trim()).filter(Boolean).join('\n\n');
}

function stuckText(message, raw) {
  return [ String(message || '').trim(), String(raw || '').trim() ].filter(Boolean).join('\n\n');
}

function failureJson(err, result) {
  if (err) {
    const packet = {
      message: err.message || '',
      status: err.status || null,
      errorCode: err.errorCode || '',
      skill: err.skill || '',
      action: err.action || '',
      detail: err.detail || '',
    };
    if (err.response && typeof err.response === 'object') packet.response = err.response;
    try { return JSON.stringify(packet); } catch { return String(err.message || ''); }
  }
  if (result && typeof result === 'object') {
    try { return JSON.stringify(result); } catch { return ''; }
  }
  return '';
}

function tracePacket(shot, extra = {}) {
  const packet = {
    scene: shot.scene_label || '',
    description: shot.description || '',
    dialogue: shot.dialogue || '',
    source_excerpt: shot.source_excerpt || '',
    duration_sec: shot.duration_sec,
    wardrobe_state: shot.wardrobe_state || '',
  };
  if (shot.asset_facts) packet.asset_facts = shot.asset_facts;
  if (shot.prev_shot) {
    packet.prev_shot = {
      shot_code: shot.prev_shot.shot_code || '',
      scene_label: shot.prev_shot.scene_label || '',
      same_scene: Boolean(shot.prev_shot.same_scene),
      has_prompt: Boolean(shot.prev_shot.positive_zh),
    };
  }
  if (extra.positive_zh) packet.positive_zh = extra.positive_zh;
  if (extra.prompt_part) packet.prompt_part = extra.prompt_part;
  return clipText(JSON.stringify(packet, null, 2));
}

function rosterText(script) {
  const people = Array.isArray(script?.characters) ? script.characters : [];
  return people.map(person => [ person?.name, person?.look, person?.stage_note ]
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join(' '))
    .filter(Boolean)
    .join('\n');
}

function coveredPlaceNames(script, description) {
  const text = String(description || '');
  const places = (Array.isArray(script?.places) ? script.places : [])
    .map(item => String(item?.name || '').trim())
    .filter(Boolean);
  const names = new Set(places.filter(name => text.includes(name)));
  (Array.isArray(script?.scenes) ? script.scenes : []).forEach((scene, index) => {
    const title = String(scene?.title || '').trim();
    const place = String(scene?.place || '').trim();
    const mentioned = text.includes(`第${index + 1}场`) || (title && text.includes(title));
    if (!mentioned) return;
    if (place) names.add(place);
    places.forEach(name => {
      if (title.includes(name)) names.add(name);
    });
  });
  return [ ...names ];
}

function skillTimeout(ctx) {
  const floor = 2 * 60 * 60 * 1000;
  const configured = Number(ctx.app.config.agentPlatform?.timeoutMs);
  if (Number.isFinite(configured) && configured >= floor) return configured;
  return floor;
}

function lockIssues(script, body) {
  const source = String(body || '');
  return settleScript(script, source, 0);
}

function negativeNeedsRetry(prompt) {
  const negative = String(prompt?.negative_zh || '').trim();
  if (!negative) return true;
  return negative.length < 80 && /拦截|违规|敏感|无法提供|不能生成|内容安全/.test(negative);
}

function styleWithoutBody(styleCtx) {
  const copy = { ...styleCtx };
  delete copy.body;
  return copy;
}

const PROMPT_FORM_FIELDS = [
  { key: 'description', label: '涵盖内容', hint: '这一镜要拍的剧情。提示词按这段来写。', rows: 4 },
  { key: 'dialogue', label: '对白', hint: '这一镜里要说的原句。', rows: 3 },
  { key: 'duration_sec', label: '时长', hint: '秒。动作按 5 到 15 秒，对白可以补到 30 秒。', rows: 1 },
  { key: 'shot_sizes', label: '景别', hint: '这一镜会用到的景别，多个用顿号分开。', rows: 1 },
  { key: 'camera_moves', label: '运镜', hint: '这一镜的运镜，按先后写，多个用顿号分开。', rows: 1 },
  { key: 'source_excerpt', label: '原文', hint: '这一镜对应的章节原文。', rows: 4 },
  { key: 'scene_label', label: '场次', hint: '这一镜的地点和时间。', rows: 1 },
  { key: 'wardrobe_state', label: '服装', hint: '这一镜结束时还穿着什么。', rows: 2 },
  { key: 'visual_style_label', label: '画面风格', hint: '项目选定的风格名称。只用于这次生成，不改项目设置。', rows: 1 },
  { key: 'visual_style_prompt', label: '风格说明', hint: '写进提示词的风格句子。只用于这次生成，不改项目设置。', rows: 3 },
  { key: 'genre', label: '题材', hint: '来源小说的题材。', rows: 1 },
  { key: 'genre_subcategory', label: '题材细分', hint: '来源小说的细分题材。', rows: 1 },
  { key: 'asset_facts', label: '人物卡', hint: '这一镜出场人物的年龄、性别和定性。', rows: 4 },
  { key: 'prev_shot', label: '上一镜', hint: '上一镜的剧情和对白，用来接上，不要重演。', rows: 4 },
  { key: 'content_type', label: '内容类型', hint: '项目类型。只用于这次生成。', rows: 1 },
  { key: 'av_mode', label: '成人模式', hint: '填「是」或「否」。为是时才按成人内容写部位。', rows: 1 },
  { key: 'topics', label: '内容标签', hint: '例如 AV、健身。留空则这次不走对应收口。', rows: 1 },
];

function topicLabel(value) {
  const hit = TOPIC_OPTIONS.find(item => item.value === value);
  return hit?.label || value;
}

function topicsFromField(text) {
  const tokens = String(text || '').split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean);
  const values = [];
  tokens.forEach(token => {
    const hit = TOPIC_OPTIONS.find(item => item.value === token || item.label === token);
    if (hit && !values.includes(hit.value)) values.push(hit.value);
  });
  return values;
}

function avFromField(text) {
  const value = String(text || '').trim();
  return value === '是' || value === 'true' || value === '1';
}

function prevShotText(prev) {
  if (!prev) return '';
  const lines = [];
  if (prev.shot_code) lines.push(`镜头 ${prev.shot_code}`);
  if (prev.scene_label) lines.push(`场次 ${prev.scene_label}`);
  lines.push(`同场 ${prev.same_scene ? '是' : '否'}`);
  if (prev.description) lines.push(`剧情 ${prev.description}`);
  if (prev.dialogue) lines.push(`对白 ${prev.dialogue}`);
  return lines.join('\n');
}

function fieldMap(fields) {
  const map = {};
  (Array.isArray(fields) ? fields : []).forEach(item => {
    if (item?.key) map[item.key] = String(item.value ?? '');
  });
  return map;
}

function overlayFields(base, incoming) {
  const map = fieldMap(base);
  if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
    Object.keys(incoming).forEach(key => {
      map[key] = String(incoming[key] ?? '');
    });
  }
  return PROMPT_FORM_FIELDS.map(item => ({ ...item, value: map[item.key] || '' }));
}

function readScoreValue(value) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 10) return null;
  return score;
}

function readScoreText(text) {
  const raw = String(text || '');
  const matched = raw.match(/评分\s*[:：]\s*(\d{1,2})/);
  if (!matched) return { score: null, score_note: '' };
  const score = readScoreValue(Number(matched[1]));
  const reason = raw.match(/理由\s*[:：]\s*([^。\n]+)/);
  return { score, score_note: reason ? reason[1].trim() : '' };
}

class DraftService extends Service {
  async callSkill(spec) {
    const payload = { ...(spec.payload || {}) };
    if (this.executionRunId) payload.trace_run_id = this.executionRunId;
    const title = spec.traceTitle || this.traceTitle || '';
    if (title) payload.trace_title = title;
    this.traceTitle = '';
    const started = Date.now();
    try {
      const result = await invokeSkill(this.ctx, { ...spec, payload });
      this.traceElapsed = Date.now() - started;
      this.traceErrorJson = '';
      this.traceResult = result;
      return result;
    } catch (err) {
      this.traceElapsed = Date.now() - started;
      this.traceErrorJson = failureJson(err);
      this.traceResult = null;
      throw err;
    }
  }

  async rememberTrace(existing, part, title, skill, input, output, status = 'ok') {
    this.traceStep = (this.traceStep || 0) + 1;
    const state = status === 'error' || status === 'skip' ? status : 'ok';
    const elapsed = Number(this.traceElapsed) || 0;
    const errorJson = state === 'error'
      ? (this.traceErrorJson || failureJson(null, this.traceResult))
      : '';
    this.traceElapsed = 0;
    this.traceErrorJson = '';
    this.traceResult = null;
    if (state === 'error') this.failureNoted = true;
    try {
      await this.ctx.model.PromptTrace.create({
        project_id: existing.project_id,
        shot_id: existing.id,
        part,
        step: this.traceStep,
        title,
        status: state,
        skill,
        input_text: clipText(input),
        output_text: clipText(output, 12000),
        elapsed_ms: elapsed,
        error_json: clipText(errorJson, 20000),
      });
    } catch (err) {
      this.ctx.logger.warn('[cartoon] 提示词记录没有写下 %s', err.message);
    }
    if (this.executionRunId && (!skill || state === 'skip')) {
      await noteStep(this.ctx, this.executionRunId, {
        node_key: String(title || 'note').slice(0, 80),
        title: String(title || '记录').slice(0, 80),
        skill_name: skill || '',
        status: state,
        log_text: state === 'skip' ? '已跳过' : (state === 'error' ? '已中断' : '已写回'),
        elapsed_ms: elapsed,
      });
    }
  }

  async load(projectId, importId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const chapter = await this.ctx.model.Import.findByPk(importId);
    if (!chapter || String(chapter.project_id) !== String(projectId)) this.ctx.throw(404, '章节快照不存在');
    return { project, chapter };
  }

  async styleContext(project, chapter = null) {
    let novel = null;
    if (project.source_novel_id) {
      try {
        novel = await this.ctx.service.project.novelBrief(project.source_novel_id);
      } catch (err) {
        this.ctx.logger.warn('[cartoon] novel brief for draft %s', err.message);
      }
    }
    const composed = composeProjectStyle(project);
    const payload = {
      visual_style: composed.visual_style,
      visual_style_label: composed.visual_style_label,
      visual_style_prompt: composed.visual_style_prompt,
      style_ids: composed.style_ids,
      style_layers: composed.style_layers,
      genre: novel?.genre || '',
      genre_subcategory: novel?.genre_subcategory || '',
      novel_type: novel?.novel_type || '',
      title: novel?.title || project.name || '',
      summary: novel?.summary || '',
      story_overview: novel?.story_overview || '',
      chapter_title: chapter?.chapter_title || '',
      body: String(chapter?.body || ''),
    };
    return {
      ...payload,
      is_xianxia: detectXianxia(payload),
    };
  }

  /** 只生成完整剧本，不拆分镜、不写提示词 */
  async suggestScript(projectId, importId) {
    const claim = begin(this.app, { projectId, kind: 'script', targetId: importId });
    if (claim.joined) return claim.done;
    try {
      const result = await this.composeScript(projectId, importId, claim.signal);
      finish(this.app, claim.row, null, result);
      return result;
    } catch (err) {
      finish(this.app, claim.row, err);
      throw err;
    }
  }

  async characterCards(projectId) {
    return this.ctx.model.Asset.findAll({
      where: { project_id: projectId, kind: 'character', disabled: false },
      order: [[ 'id', 'ASC' ]],
    });
  }

  async projectFactText(projectId) {
    return assetFactText(await this.characterCards(projectId));
  }

  async shotFactText(projectId, text) {
    return assetFactText(namedAssets(await this.characterCards(projectId), text));
  }

  async previousShotContext(projectId, importId, shot) {
    const order = Number(shot?.sort_order);
    if (!Number.isFinite(order)) return null;
    const { Op } = this.app.Sequelize;
    const prev = await this.ctx.model.Shot.findOne({
      where: {
        project_id: projectId,
        import_id: importId,
        sort_order: { [Op.lt]: order },
      },
      order: [[ 'sort_order', 'DESC' ], [ 'id', 'DESC' ]],
    });
    if (!prev) return null;
    const prompt = await this.ctx.model.Prompt.findOne({ where: { shot_id: prev.id } });
    const prevScene = Number(prev.scene_index);
    const currentScene = Number(shot.scene_index);
    const sameScene = prevScene > 0 && currentScene > 0
      ? prevScene === currentScene
      : Boolean(prev.scene_label) && prev.scene_label === shot.scene_label;
    const context = {
      shot_code: prev.shot_code || '',
      scene_index: prevScene > 0 ? prevScene : null,
      scene_label: prev.scene_label || '',
      same_scene: sameScene,
      description: clipSpan(prev.description),
      dialogue: clipText(prev.dialogue, 1200),
      duration_sec: prev.duration_ms ? Math.round(prev.duration_ms / 1000) : null,
      wardrobe_state: String(prev.wardrobe_state || '').trim(),
    };
    const positive = clipSpan(prompt?.positive_zh, 800, 1600);
    const frameEnd = clipText(prompt?.frame_end_zh, 1200);
    if (positive) context.positive_zh = positive;
    if (frameEnd) context.frame_end_zh = frameEnd;
    return context;
  }

  async ensureShotExcerpt(shot, chapter) {
    const saved = String(shot?.source_excerpt || '').trim();
    if (saved) return saved;
    if (Number(shot?.project_id) === 4) return '';
    const excerpt = matchExcerpt(chapterParagraphs(chapter?.body), shot);
    if (!excerpt) return '';
    try {
      await shot.update({ source_excerpt: excerpt });
    } catch (err) {
      if (!/source_excerpt/i.test(String(err.message || ''))) throw err;
      return '';
    }
    return excerpt;
  }

  async composeScript(projectId, importId, signal) {
    const { project, chapter } = await this.load(projectId, importId);
    const scriptResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-script-skill',
      action: 'draft',
      timeoutMs: skillTimeout(this.ctx),
      signal,
      payload: {
        chapter_title: chapter.chapter_title || '',
        ...productionInput(project),
        body: chapter.body,
        asset_facts: await this.projectFactText(project.id),
      },
    });
    const scriptOutput = outputOf(scriptResult);
    const scriptData = scriptOutput.script_data;
    if (scriptData?.truncated) {
      this.ctx.throw(502, '剧本回答被截断，已经整份重写过仍不完整。这一稿没有保存，请再生成一次');
    }
    if (!scriptData || !Array.isArray(scriptData.scenes) || !scriptData.scenes.length) {
      const reply = String(scriptOutput.reply || scriptOutput.summary || '').replace(/\s+/g, ' ').trim();
      this.ctx.throw(502, reply ? `剧本没有定稿。${reply.slice(0, 240)}` : '剧本没有定稿');
    }
    const settled = settleScript(scriptData, chapter.body, 0, { coverStory: true });
    if (settled.issues.length) {
      this.ctx.throw(502, `剧本没有定稿。${settled.issues.slice(0, 4).join('；')}。这一稿没有保存，请再生成一次`);
    }
    const named = normalizeScript({
      ...settled.script,
      accepted: true,
      reject_reasons: [],
      shot_omissions: [],
    });
    delete named.truncated;
    await chapter.update({
      script_data: { ...named, shot_omissions: [] },
      characters: named.characters || [],
    });
    return {
      script_data: named,
      persisted: true,
    };
  }

  async applyScript(projectId, importId, payload) {
    const { chapter } = await this.load(projectId, importId);
    const incoming = payload.script_data;
    if (!incoming || !Array.isArray(incoming.scenes) || !incoming.scenes.length) {
      this.ctx.throw(400, '需要场次');
    }
    const settled = lockIssues(incoming, chapter.body);
    if (settled.issues.length) {
      this.ctx.throw(400, `剧本还不能保存。${settled.issues.slice(0, 4).join('；')}`);
    }
    const scriptData = normalizeScript({
      ...settled.script,
      accepted: true,
      reject_reasons: [],
    });
    await chapter.update({
      script_data: { ...scriptData, shot_omissions: [] },
      characters: scriptData.characters || [],
    });
    return this.ctx.service.project.show(projectId);
  }

  /** 按已有剧本拆镜头大纲并落库；与镜头页共用同一批 Shot */
  async insertOutlineShots({ projectPk, importPk, chapter, script, shots, episode, order }) {
    const episodeRow = episode || await this.ctx.service.project.ensureEpisode(projectPk);
    let next = order;
    if (!Number.isFinite(next)) {
      const maxOrder = await this.ctx.model.Shot.max('sort_order', { where: { project_id: projectPk } });
      next = Number.isFinite(maxOrder) ? maxOrder + 1 : 0;
    }
    const codes = await this.ctx.service.project.allocateShotCodes(projectPk, shots.length);
    const ids = [];
    for (let i = 0; i < shots.length; i += 1) {
      const item = shots[i];
      const fields = {
        project_id: projectPk,
        import_id: importPk,
        video_task_id: episodeRow.id,
        sort_order: next,
        shot_code: codes[i],
        shot_size: item.shot_size,
        camera_move: item.camera_move,
        description: item.coverage,
        dialogue: item.dialogue,
        duration_ms: item.duration_sec * 1000,
        scene_index: Number.isInteger(Number(item.scene_index)) && Number(item.scene_index) > 0 ? Number(item.scene_index) : null,
        scene_label: sceneTitle(script, item),
        source_excerpt: resolveExcerpt(chapter.body, {
          description: item.coverage,
          dialogue: item.dialogue,
        }, item.source_indexes),
        wardrobe_state: wardrobeText(item.wardrobe_state) || sceneWardrobe(script, item.scene_index, sceneTitle(script, item)),
      };
      let row;
      try {
        row = await this.ctx.model.Shot.create(fields);
      } catch (err) {
        const message = String(err.message || '');
        const dropWardrobe = /wardrobe_state/i.test(message);
        const dropCode = /shot_code/i.test(message);
        const dropScene = /scene_index/i.test(message);
        if (!dropWardrobe && !dropCode && !dropScene) throw err;
        if (dropWardrobe) delete fields.wardrobe_state;
        if (dropCode) delete fields.shot_code;
        if (dropScene) delete fields.scene_index;
        this.ctx.logger.warn('[cartoon] shot create retry: %s', message);
        row = await this.ctx.model.Shot.create(fields);
      }
      ids.push(row.id);
      next += 1;
    }
    return { episode: episodeRow, order: next, ids };
  }

  async reportSceneWrite(projectPk, importPk, text) {
    const run = await this.ctx.model.FullRun.findOne({
      where: { project_id: projectPk, import_id: importPk, status: 'running' },
      order: [[ 'id', 'DESC' ]],
    });
    if (!run) return;
    const kind = String(run.run_kind || '');
    const node = String(run.current_node || '');
    if (node !== 'storyboard' && kind !== 'storyboard') return;
    await this.ctx.service.fullAuto.reportSlice(run, 'storyboard', text);
  }

  async suggestShotOutline(projectId, importId, payload = {}) {
    const claim = begin(this.app, { projectId, kind: 'outline', targetId: importId });
    if (claim.joined) return claim.done;
    try {
      const result = await this.composeOutline(projectId, importId, payload, claim.signal);
      finish(this.app, claim.row, null, result);
      return result;
    } catch (err) {
      finish(this.app, claim.row, err);
      throw err;
    }
  }

  async composeOutline(projectId, importId, payload = {}, signal) {
    const { project, chapter } = await this.load(projectId, importId);
    const scriptData = chapter.script_data;
    if (!scriptData || !Array.isArray(scriptData.scenes) || !scriptData.scenes.length) {
      this.ctx.throw(400, '请先生成并保存剧本');
    }
    const importPk = Number(chapter.id);
    const projectPk = Number(project.id);
    const replace = payload.replace === true || payload.replace === 1 || payload.replace === '1' || payload.replace === 'true';
    const existing = await this.ctx.model.Shot.findAll({
      where: { project_id: projectPk, import_id: importPk },
    });
    if (existing.length && !replace) {
      this.ctx.throw(409, '该快照已有分镜，请确认后重新拆分');
    }
    const settled = lockIssues(scriptData, chapter.body);
    if (settled.issues.length) {
      this.ctx.throw(400, `剧本还不能交给分镜。${settled.issues.slice(0, 4).join('；')}`);
    }
    const styleCtx = await this.styleContext(project, chapter);
    const spans = sceneSpans(settled.script, chapter.body);
    const stylePayload = styleWithoutBody(styleCtx);
    const source = productionInput(project);
    const outline = [];
    const shotOmissions = [];
    const createdIds = [];
    let previous = null;
    let episode = null;
    let order = null;
    let retired = false;
    for (const span of spans) {
      if (signal?.aborted) throw stopError();
      const sceneIndex = span.scene_index;
      const scene = settled.script.scenes[sceneIndex - 1];
      const sceneText = [
        scene?.title,
        scene?.summary,
        scene?.wardrobe,
        ...(span.paragraphs || []).map(item => item.text),
      ].filter(Boolean).join('\n');
      const beat = Math.max(1, Math.ceil(((span.paragraphs || []).length || 1) / 4));
      this.ctx.logger.info('[cartoon] shot-outline scene %s/%s', sceneIndex, spans.length);
      const outlinePayload = {
        script_data: {
          logline: settled.script.logline || '',
          summary: settled.script.summary || '',
          characters: settled.script.characters || [],
          places: settled.script.places || [],
          scenes: [ scene ],
        },
        outline_only: true,
        scene_index: sceneIndex,
        ...stylePayload,
        body: String(chapter.body || ''),
        scene_spans: [ span ],
        ...source,
        min_shots: beat,
        asset_facts: await this.shotFactText(project.id, sceneText),
        prev_shot: previous,
      };
      let boardResult;
      try {
        boardResult = await invokeSkill(this.ctx, {
          skill: 'cartoon-storyboard-skill',
          action: 'draft',
          timeoutMs: skillTimeout(this.ctx),
          signal,
          payload: outlinePayload,
        });
      } catch (err) {
        if (signal?.aborted || err?.status === 499 || err?.message === '已停止') throw err;
        const wrapped = new Error(`第${sceneIndex}场镜头没有生成。${err.message || ''}`.trim());
        wrapped.status = err.status || 502;
        throw wrapped;
      }
      const takeShots = output => (Array.isArray(output?.shots) ? output.shots : []).map(item => ({
        scene_index: sceneIndex,
        coverage: String(item.description || item.coverage || item.summary || '').trim(),
        duration_sec: fitDurationSec(item.duration_sec, item.dialogue, 10),
        shot_size: serializeShotSizes(item.shot_sizes != null ? item.shot_sizes : item.shot_size),
        camera_move: serializeCameraMoves(item.camera_moves != null ? item.camera_moves : item.camera_move),
        dialogue: String(item.dialogue || '').trim(),
        source_indexes: item.source_indexes,
        wardrobe_state: wardrobeText(item.wardrobe_state),
      })).filter(item => item.coverage);
      const boardOutput = outputOf(boardResult);
      const sceneShots = takeShots(boardOutput);
      normalizeOmissions(boardOutput.omissions)
        .filter(item => !skipExcuse(item.reason))
        .forEach(item => {
          shotOmissions.push({
            target: item.target || `第${sceneIndex}场`,
            reason: item.reason,
            ...(item.notice ? { notice: item.notice } : {}),
          });
        });
      if (!sceneShots.length) {
        const title = String(scene?.title || '').trim();
        const summary = String(scene?.summary || '').replace(/\s+/g, ' ').trim();
        const summaryClip = summary.length > 80 ? `${summary.slice(0, 80)}…` : summary;
        shotOmissions.push({
          target: `第${sceneIndex}场`,
          notice: '分镜合并',
          reason: `这一场没有交镜头，剧情按合并保留${title ? `：「${title}」` : ''}${summaryClip ? `。摘要：${summaryClip}` : ''}。后面的场继续拆。`,
        });
        await chapter.update({
          script_data: { ...settled.script, shot_omissions: shotOmissions },
        });
        await this.reportSceneWrite(
          projectPk,
          importPk,
          `第${sceneIndex}/${spans.length}场没有单独镜头，已记为合并，继续后面的场`,
        );
        continue;
      }
      const missed = lostParagraphOmission(sceneIndex, span.paragraphs, sceneShots);
      if (missed) shotOmissions.push(missed);
      sceneShots.forEach(item => {
        item.index = outline.length;
        outline.push(item);
      });
      const last = sceneShots[sceneShots.length - 1];
      previous = {
        scene_index: sceneIndex,
        scene_label: sceneTitle(settled.script, { scene_index: sceneIndex }),
        description: clipSpan(last.coverage, 800, 1200),
        dialogue: clipText(last.dialogue, 800),
        duration_sec: last.duration_sec,
        same_scene: false,
      };
      if (!retired && existing.length) {
        await this.ctx.service.project.destroyShotsByIds(existing.map(item => item.id));
        retired = true;
        order = null;
      }
      const inserted = await this.insertOutlineShots({
        projectPk,
        importPk,
        chapter,
        script: settled.script,
        shots: sceneShots,
        episode,
        order,
      });
      episode = inserted.episode;
      order = inserted.order;
      createdIds.push(...inserted.ids);
      await chapter.update({
        script_data: { ...settled.script, shot_omissions: shotOmissions },
      });
      await this.reportSceneWrite(
        projectPk,
        importPk,
        `第${sceneIndex}/${spans.length}场已写入 ${sceneShots.length} 条镜头，累计 ${outline.length} 条`,
      );
    }
    const locked = settled.script;
    await chapter.update({
      script_data: { ...locked, shot_omissions: shotOmissions },
    });
    if (outline.length) await this.ctx.service.project.ensureShotCodes(projectPk);
    this.ctx.logger.info('[cartoon] shot-outline import=%s created=%s', importPk, createdIds.length);
    const verified = await this.ctx.model.Shot.count({ where: { project_id: projectPk, import_id: importPk } });
    if (outline.length && verified < 1) this.ctx.throw(502, '分镜写入后查询为空，请检查数据库');
    const detail = await this.ctx.service.project.show(projectPk);
    return {
      ...detail,
      created: createdIds.length,
      import_id: importPk,
    };
  }

  /** 已有镜头行 → 完整分镜描写 + 提示词，更新同一条 Shot */
  async expandShot(projectId, importId, payload) {
    const { project, chapter } = await this.load(projectId, importId);
    const scriptData = chapter.script_data || payload.script_data;
    if (!scriptData || !Array.isArray(scriptData.scenes) || !scriptData.scenes.length) {
      this.ctx.throw(400, '请先生成并保存剧本');
    }
    const settledScript = lockIssues(scriptData, chapter.body);
    if (settledScript.issues.length) {
      this.ctx.throw(400, `剧本还不能交给分镜。${settledScript.issues.slice(0, 4).join('；')}`);
    }
    const shotId = payload.shot_id;
    if (!shotId) this.ctx.throw(400, '需要镜头 id');
    const existing = await this.ctx.model.Shot.findOne({
      where: { id: shotId, project_id: project.id, import_id: chapter.id },
    });
    if (!existing) this.ctx.throw(404, '镜头不存在');
    const claim = begin(this.app, { projectId: project.id, kind: 'prompt', targetId: existing.id });
    if (claim.joined) return claim.done;
    const stop = {
      signal: claim.signal,
      stopped() { return claim.signal.aborted; },
      release() {},
    };
    const coverage = String(payload.coverage || payload.description || existing.description || '').trim();
    if (!coverage) {
      finish(this.app, claim.row, Object.assign(new Error('需要镜头涵盖的剧本内容'), { status: 400 }));
      this.ctx.throw(400, '需要镜头涵盖的剧本内容');
    }
    const durationSec = fitDurationSec(
      payload.duration_sec != null ? payload.duration_sec : (existing.duration_ms ? existing.duration_ms / 1000 : 10),
      payload.dialogue != null ? payload.dialogue : existing.dialogue,
      10,
    );
    const styleCtx = await this.styleContext(project, chapter);
    const seedSizes = normalizeShotSizes(
      payload.shot_sizes != null ? payload.shot_sizes
        : (payload.shot_size != null ? payload.shot_size : existing.shot_size),
    );
    const seedMoves = normalizeCameraMoves(
      payload.camera_moves != null ? payload.camera_moves
        : (payload.camera_move != null ? payload.camera_move : existing.camera_move),
    );
    const sourceExcerpt = await this.ensureShotExcerpt(existing, chapter);
    this.traceStep = 0;
    this.failureNoted = false;
    try {
      await this.ctx.model.PromptTrace.destroy({ where: { shot_id: existing.id } });
    } catch (err) {
      this.ctx.logger.warn('[cartoon] 旧提示词记录没有清掉 %s', err.message);
    }
    const seedShot = {
      description: coverage,
      duration_sec: durationSec,
      shot_size: serializeShotSizes(seedSizes),
      shot_sizes: seedSizes,
      camera_move: serializeCameraMoves(seedMoves),
      camera_moves: seedMoves,
      dialogue: String(payload.dialogue != null ? payload.dialogue : (existing.dialogue || '')).trim(),
      source_excerpt: sourceExcerpt,
      scene_label: existing.scene_label || '',
      wardrobe_state: String(existing.wardrobe_state || '').trim() || sceneWardrobe(settledScript.script, null, existing.scene_label),
    };
    const seedFacts = await this.shotFactText(project.id, [ seedShot.description, seedShot.dialogue ].join('\n'));
    seedShot.asset_facts = seedFacts;
    const prevShot = await this.previousShotContext(project.id, chapter.id, existing);
    if (prevShot) seedShot.prev_shot = prevShot;
    const ensureRunning = () => {
      if (stop.stopped()) throw stopError();
    };
    this.executionRunId = await openRun(this.ctx, {
      app_key: 'cartoon',
      skill_name: 'cartoon-storyboard-skill',
      action: 'expand_one',
      flow_key: 'prompt',
      title: '提示词',
      target_label: String(existing.shot_code || ''),
    });
    this.executionStarted = Date.now();
    this.executionStatus = 'ok';
    this.executionError = '';
    let boardResult;
    try {
      ensureRunning();
      try {
        this.traceTitle = '单段扩写';
        boardResult = await this.callSkill({
          skill: 'cartoon-storyboard-skill',
          action: 'draft',
          timeoutMs: skillTimeout(this.ctx),
          signal: stop.signal,
          payload: {
            script_data: settledScript.script,
            expand_one: true,
            seed_shot: seedShot,
            prev_shot: seedShot.prev_shot || null,
            asset_facts: seedFacts,
            ...styleWithoutBody(styleCtx),
            ...productionInput(project),
          },
        });
      } catch (err) {
        await this.rememberTrace(
          existing, 'video', '单段扩写', 'cartoon-storyboard-skill',
          tracePacket(seedShot), stuckText(err.message, skillRaw(err.result)), 'error',
        );
        throw err;
      }
      ensureRunning();
    const expanded = (outputOf(boardResult).shots || [])[0];
    const expandedSizes = normalizeShotSizes(
      expanded?.shot_sizes != null ? expanded.shot_sizes
        : (expanded?.shot_size != null ? expanded.shot_size : seedShot.shot_sizes),
    );
    const expandedMoves = normalizeCameraMoves(
      expanded?.camera_moves != null ? expanded.camera_moves
        : (expanded?.camera_move != null ? expanded.camera_move : seedShot.camera_moves),
    );
    const shot = {
      description: String(expanded?.description || seedShot.description).trim(),
      duration_sec: fitDurationSec(
        Math.max(Number(expanded?.duration_sec) || 0, durationSec),
        expanded?.dialogue || seedShot.dialogue,
        durationSec,
      ),
      shot_size: serializeShotSizes(expandedSizes),
      shot_sizes: expandedSizes,
      camera_move: serializeCameraMoves(expandedMoves),
      camera_moves: expandedMoves,
      dialogue: String(expanded?.dialogue || seedShot.dialogue).trim(),
      source_excerpt: sourceExcerpt,
      scene_label: existing.scene_label || '',
      wardrobe_state: wardrobeText(expanded?.wardrobe_state) || seedShot.wardrobe_state || '',
    };
    if (seedShot.prev_shot) shot.prev_shot = seedShot.prev_shot;
    if (!shot.description) {
      await this.rememberTrace(
        existing, 'video', '单段扩写', 'cartoon-storyboard-skill',
        tracePacket(seedShot), stuckText('没有返回分镜描述', skillRaw(boardResult)), 'error',
      );
      this.ctx.throw(502, '没有返回分镜描述');
    }
    await this.rememberTrace(
      existing,
      'video',
      '单段扩写',
      'cartoon-storyboard-skill',
      tracePacket(seedShot),
      shot.description,
    );
    const shotFacts = await this.shotFactText(project.id, [ shot.description, shot.dialogue ].join('\n'));
    shot.asset_facts = shotFacts;
    const promptPayload = {
      repair_note: String(payload.repair_note || '').trim(),
      asset_facts: shotFacts,
      ...styleWithoutBody(styleCtx),
      body: '',
      ...productionInput(project),
    };
    const partTitle = {
      positive: '视频提示词',
      negative: '负向补调',
      frame_start: '首帧提示词',
      frame_end: '尾帧提示词',
    };
    const partName = {
      positive: 'video',
      negative: 'video',
      frame_start: 'frame_start',
      frame_end: 'frame_end',
    };
    const requestPart = async (part, current) => {
      ensureRunning();
      const input = tracePacket(current, { prompt_part: part, positive_zh: current.positive_zh });
      let result;
      try {
        this.traceTitle = partTitle[part] || part;
        result = await this.callSkill({
          skill: 'cartoon-prompt-skill',
          action: 'draft',
          timeoutMs: skillTimeout(this.ctx),
          signal: stop.signal,
          payload: {
            ...promptPayload,
            prompt_part: part,
            shots: [ current ],
          },
        });
      } catch (err) {
        await this.rememberTrace(
          existing, partName[part] || 'video', partTitle[part] || part, 'cartoon-prompt-skill',
          input, err.message, 'error',
        );
        throw err;
      }
      const output = outputOf(result);
      const row = (output.prompts || [])[0] || {};
      row.reply = String(output.reply || output.summary || '').replace(/\s+/g, ' ').trim();
      row.raw_text = skillRaw(result);
      return row;
    };
    const gaps = [];
    const halted = err => err?.status === 499 || err?.message === '已停止' || stop.stopped();
    const keepPrompt = async fields => {
      const next = {};
      [ 'positive_zh', 'frame_start_zh', 'frame_end_zh', 'negative_zh' ].forEach(key => {
        const value = String(fields[key] || '').trim();
        if (value) next[key] = value;
      });
      if (!Object.keys(next).length) return null;
      const row = await this.ctx.model.Prompt.findOne({ where: { shot_id: existing.id } });
      if (row) await row.update(next);
      else await this.ctx.model.Prompt.create({ shot_id: existing.id, ...next });
      return next;
    };
    let video = {};
    try {
      video = await requestPart('positive', shot);
    } catch (err) {
      if (halted(err)) throw err;
      video = { reply: err?.message || '' };
    }
    const positive = String(video.positive_zh || '').trim();
    if (!positive) {
      const message = video.reply ? `没有返回视频提示词。${video.reply.slice(0, 160)}` : '没有返回视频提示词';
      await this.rememberTrace(
        existing, 'video', '视频提示词', 'cartoon-prompt-skill',
        tracePacket(shot, { prompt_part: 'positive' }),
        stuckText(message, video.raw_text),
        'error',
      );
      gaps.push(message);
    }
    if (positive) await this.rememberTrace(
      existing,
      'video',
      '视频提示词',
      'cartoon-prompt-skill',
      tracePacket(shot, { prompt_part: 'positive' }),
      positive,
    );
    let prompt = {
      positive_zh: positive,
      negative_zh: positive ? String(video.negative_zh || '').trim() : '',
      production_note: positive ? String(video.production_note || '').trim() : '',
    };
    if (positive && negativeNeedsRetry(prompt)) {
      try {
        const again = await requestPart('negative', { ...shot, positive_zh: positive, negative_only: true });
        if (String(again.negative_zh || '').trim()) prompt = { ...prompt, negative_zh: String(again.negative_zh).trim() };
        await this.rememberTrace(
          existing,
          'video',
          '负向补调',
          'cartoon-prompt-skill',
          tracePacket(shot, { prompt_part: 'negative' }),
          String(prompt.negative_zh || ''),
        );
      } catch (err) {
        if (err?.status === 499 || err?.message === '已停止') throw err;
        this.ctx.logger.warn('[cartoon] 负向提示词补调失败 %s', err.message);
      }
    } else if (positive) {
      await this.rememberTrace(
        existing, 'video', '负向补调', 'cartoon-prompt-skill',
        tracePacket(shot, { prompt_part: 'negative' }),
        '负向已经够用，没有再调。',
        'skip',
      );
    }
    const closers = [
      { key: 'av', skill: 'cartoon-av-prompt-skill', title: 'AV 收口' },
      { key: 'fitness', skill: 'cartoon-fitness-prompt-skill', title: '健身收口' },
    ];
    const selectedTopics = topicsOf(project);
    for (const closer of closers) {
      if (!positive || !selectedTopics.includes(closer.key)) continue;
      try {
        ensureRunning();
        this.traceTitle = closer.title;
        const closed = await this.callSkill({
          skill: closer.skill,
          action: 'draft',
          timeoutMs: skillTimeout(this.ctx),
          signal: stop.signal,
          payload: {
            ...promptPayload,
            prompt_part: 'positive',
            av_mode: selectedTopics.includes('av'),
            fitness: selectedTopics.includes('fitness'),
            topics: selectedTopics,
            shots: [{
              ...shot,
              positive_zh: picturePrompt(prompt.positive_zh),
              draft_positive_zh: picturePrompt(prompt.positive_zh),
              draft_negative_zh: String(prompt.negative_zh || '').trim(),
              draft_production_note: String(prompt.production_note || '').trim(),
              roster_text: rosterText(settledScript.script),
            }],
          },
        });
        const again = (outputOf(closed).prompts || [])[0] || {};
        const closedPositive = picturePrompt(again.positive_zh) || String(again.positive_zh || '').trim();
        if (closedPositive) {
          prompt = {
            ...prompt,
            positive_zh: closedPositive,
            negative_zh: String(again.negative_zh || prompt.negative_zh || '').trim(),
            production_note: String(again.production_note || prompt.production_note || '').trim(),
          };
          await this.rememberTrace(
            existing,
            'video',
            closer.title,
            closer.skill,
            tracePacket(shot, { prompt_part: 'positive', positive_zh: picturePrompt(positive) }),
            closedPositive,
          );
        } else {
          await this.rememberTrace(
            existing, 'video', closer.title, closer.skill,
            tracePacket(shot, { prompt_part: 'positive', positive_zh: picturePrompt(positive) }),
            stuckText('没有画面提示词，沿用已写好的提示词', skillRaw(closed)),
            'error',
          );
          this.ctx.logger.warn('[cartoon] %s没有画面提示词，沿用已写好的提示词', closer.title);
        }
      } catch (err) {
        await this.rememberTrace(
          existing, 'video', closer.title, closer.skill,
          tracePacket(shot, { prompt_part: 'positive', positive_zh: picturePrompt(positive) }),
          err.message, 'error',
        );
        if (err?.status === 499 || err?.message === '已停止') throw err;
        this.ctx.logger.warn('[cartoon] %s失败，沿用已写好的提示词 %s', closer.title, err.message);
      }
    }
    if (positive) {
      await keepPrompt({
        positive_zh: picturePrompt(prompt.positive_zh) || prompt.positive_zh,
        negative_zh: prompt.negative_zh,
      });
    }
    const kept = await this.ctx.model.Prompt.findOne({ where: { shot_id: existing.id } });
    shot.positive_zh = prompt.positive_zh || String(kept?.positive_zh || '').trim();
    const readFrame = async part => {
      const title = partTitle[part];
      let row = {};
      try {
        row = await requestPart(part, shot);
      } catch (err) {
        if (halted(err)) throw err;
        gaps.push(err?.message || `没有返回${title}`);
        return '';
      }
      const field = part === 'frame_start' ? 'frame_start_zh' : 'frame_end_zh';
      const text = String(row[field] || '').trim();
      if (!text) {
        const message = row.reply ? `没有返回${title}。${row.reply.slice(0, 160)}` : `没有返回${title}`;
        await this.rememberTrace(
          existing, partName[part], title, 'cartoon-prompt-skill',
          tracePacket(shot, { prompt_part: part, positive_zh: shot.positive_zh }),
          stuckText(message, row.raw_text),
          'error',
        );
        gaps.push(message);
        return '';
      }
      await this.rememberTrace(
        existing,
        partName[part],
        title,
        'cartoon-prompt-skill',
        tracePacket(shot, { prompt_part: part, positive_zh: shot.positive_zh }),
        text,
      );
      await keepPrompt({ [field]: picturePrompt(text) || text });
      return text;
    };
    const frameStart = await readFrame('frame_start');
    const frameEnd = await readFrame('frame_end');
    prompt = { ...prompt, frame_start_zh: frameStart, frame_end_zh: frameEnd };
    ensureRunning();
    const overrides = (Array.isArray(existing.overridden_fields) ? existing.overridden_fields : [])
      .filter(field => field !== 'assets');
    const storedNow = await this.ctx.model.Prompt.findOne({ where: { shot_id: existing.id } });
    const videoText = picturePrompt(prompt.positive_zh) || String(prompt.positive_zh || storedNow?.positive_zh || '').trim();
    const promptFields = {
      positive_zh: String(storedNow?.positive_zh || '').trim(),
      frame_start_zh: String(storedNow?.frame_start_zh || '').trim(),
      frame_end_zh: String(storedNow?.frame_end_zh || '').trim(),
      negative_zh: String(storedNow?.negative_zh || '').trim(),
    };
    const coveredMs = promptCoveredMs(videoText);
    const shotPatch = {
      shot_size: shot.shot_size,
      camera_move: shot.camera_move,
      dialogue: shot.dialogue,
      duration_ms: fitDurationSec((coveredMs || shot.duration_sec * 1000) / 1000, shot.dialogue, shot.duration_sec) * 1000,
      overridden_fields: overrides,
    };
    if (shot.wardrobe_state) shotPatch.wardrobe_state = shot.wardrobe_state;
    try {
      await existing.update(shotPatch);
    } catch (err) {
      if (!shotPatch.wardrobe_state || !/wardrobe_state/i.test(String(err.message || ''))) throw err;
      delete shotPatch.wardrobe_state;
      await existing.update(shotPatch);
    }
    const wrote = [
      promptFields.positive_zh && '视频提示词',
      promptFields.frame_start_zh && '首帧提示词',
      promptFields.frame_end_zh && '尾帧提示词',
    ].filter(Boolean);
    const missing = [ '视频提示词', '首帧提示词', '尾帧提示词' ].filter(name => !wrote.includes(name));
    if (wrote.length) {
      await this.rememberTrace(existing, 'video', '写回镜头', '', wrote.join('、'), `已写入${wrote.join('、')}`, 'ok');
    }
    await this.ctx.service.project.bindMatchedAssets(project.id, existing.id, [
      promptFields.positive_zh,
      promptFields.frame_start_zh,
      promptFields.frame_end_zh,
      promptFields.negative_zh,
      shot.description,
      shot.dialogue,
      ...coveredPlaceNames(scriptData, `${shot.description}\n${promptFields.positive_zh}\n${promptFields.frame_start_zh}\n${promptFields.frame_end_zh}`),
    ].join('\n'));
      if (missing.length) {
        const message = wrote.length
          ? `已写入${wrote.join('、')}。缺少${missing.join('、')}`
          : (gaps[0] || `缺少${missing.join('、')}`);
        this.ctx.throw(502, message);
      }
      const result = await this.ctx.service.project.show(project.id);
      finish(this.app, claim.row, null, result);
      return result;
    } catch (err) {
      this.executionStatus = 'error';
      this.executionError = String(err?.message || '失败').slice(0, 300);
      if (!this.failureNoted) {
        await this.rememberTrace(
          existing, 'video', '生成中断', '',
          tracePacket(seedShot),
          err?.message || '生成提示词中断',
          'error',
        );
      }
      finish(this.app, claim.row, err);
      throw err;
    } finally {
      await closeRun(this.ctx, this.executionRunId, {
        status: this.executionStatus || 'ok',
        error_text: this.executionError || '',
        elapsed_ms: Math.max(0, Date.now() - (this.executionStarted || Date.now())),
      });
      this.executionRunId = 0;
      stop.release();
    }
  }

  async promptForm(projectId, importId, shotId) {
    const loaded = await this.loadPromptForm(projectId, importId, shotId);
    return {
      shot_id: loaded.shot.id,
      shot_code: loaded.shot.shot_code || '',
      fields: loaded.fields,
      prompts: loaded.prompts,
    };
  }

  async submitPromptForm(projectId, importId, shotId, payload = {}) {
    const loaded = await this.loadPromptForm(projectId, importId, shotId);
    const action = payload.action === 'adjust' ? 'adjust' : 'generate';
    const part = [ 'positive', 'frame_start', 'frame_end', 'all' ].includes(payload.part) ? payload.part : 'all';
    const fields = overlayFields(loaded.fields, payload.fields);
    const requirement = String(payload.requirement || '').trim();
    const claim = begin(this.app, { projectId: loaded.project.id, kind: 'prompt-form', targetId: loaded.shot.id });
    if (claim.joined) return claim.done;
    const stop = {
      signal: claim.signal,
      stopped() { return claim.signal.aborted; },
      release() {},
    };
    try {
      if (action === 'adjust') {
        const prompts = await this.saveFormPrompts(loaded.shot.id, payload.prompts);
        const score = readScoreValue(payload.score);
        const scoreNote = String(payload.score_note || '').trim();
        const recorded = await this.recordPromptSnapshot(loaded, {
          op: '手动调整',
          part,
          requirement,
          fields,
          prompts,
          score,
          score_note: scoreNote,
        });
        const result = { prompts, score, score_note: scoreNote, memory_recorded: recorded };
        finish(this.app, claim.row, null, result);
        return result;
      }
      const generated = await this.generatePromptForm(loaded, fields, requirement, part, stop);
      const recorded = await this.recordPromptSnapshot(loaded, {
        op: '生成',
        part,
        requirement,
        fields,
        prompts: generated.prompts,
        score: generated.score,
        score_note: generated.score_note,
      });
      const result = { ...generated, memory_recorded: recorded };
      finish(this.app, claim.row, null, result);
      return result;
    } catch (err) {
      finish(this.app, claim.row, err);
      throw err;
    } finally {
      stop.release();
    }
  }

  async loadPromptForm(projectId, importId, shotId) {
    const { project, chapter } = await this.load(projectId, importId);
    const shot = await this.ctx.model.Shot.findOne({
      where: { id: shotId, project_id: project.id, import_id: chapter.id },
    });
    if (!shot) this.ctx.throw(404, '镜头不存在');
    const style = await this.styleContext(project, chapter);
    const excerpt = await this.ensureShotExcerpt(shot, chapter);
    const facts = await this.shotFactText(project.id, [ shot.description, shot.dialogue, excerpt ].filter(Boolean).join('\n'));
    const prev = await this.previousShotContext(project.id, chapter.id, shot);
    const prompt = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
    const values = {
      description: String(shot.description || '').trim(),
      dialogue: String(shot.dialogue || '').trim(),
      duration_sec: shot.duration_ms ? String(Math.round(shot.duration_ms / 1000)) : '',
      shot_sizes: serializeShotSizes(normalizeShotSizes(shot.shot_size)),
      camera_moves: serializeCameraMoves(normalizeCameraMoves(shot.camera_move)),
      source_excerpt: excerpt,
      scene_label: String(shot.scene_label || '').trim(),
      wardrobe_state: String(shot.wardrobe_state || '').trim(),
      visual_style_label: String(style.visual_style_label || '').trim(),
      visual_style_prompt: String(style.visual_style_prompt || '').trim(),
      genre: String(style.genre || '').trim(),
      genre_subcategory: String(style.genre_subcategory || '').trim(),
      asset_facts: facts,
      prev_shot: prevShotText(prev),
      content_type: String(project.content_type || '').trim(),
      av_mode: project.av_mode ? '是' : '否',
      topics: topicsOf(project).map(topicLabel).filter(Boolean).join('、'),
    };
    return {
      project,
      chapter,
      shot,
      style,
      prev,
      fields: PROMPT_FORM_FIELDS.map(item => ({ ...item, value: values[item.key] || '' })),
      prompts: {
        positive_zh: String(prompt?.positive_zh || '').trim(),
        frame_start_zh: String(prompt?.frame_start_zh || '').trim(),
        frame_end_zh: String(prompt?.frame_end_zh || '').trim(),
        negative_zh: String(prompt?.negative_zh || '').trim(),
      },
    };
  }

  async saveFormPrompts(shotId, incoming) {
    const current = await this.ctx.model.Prompt.findOne({ where: { shot_id: shotId } });
    const next = {
      positive_zh: String(current?.positive_zh || '').trim(),
      frame_start_zh: String(current?.frame_start_zh || '').trim(),
      frame_end_zh: String(current?.frame_end_zh || '').trim(),
      negative_zh: String(current?.negative_zh || '').trim(),
    };
    [ 'positive_zh', 'frame_start_zh', 'frame_end_zh', 'negative_zh' ].forEach(key => {
      if (incoming && Object.prototype.hasOwnProperty.call(incoming, key)) {
        next[key] = String(incoming[key] || '').trim();
      }
    });
    if (current) await current.update(next);
    else await this.ctx.model.Prompt.create({ shot_id: shotId, ...next });
    return next;
  }

  async recordPromptSnapshot(loaded, snapshot) {
    return recordPromptMemory(this.ctx, {
      op: snapshot.op,
      at: new Date().toISOString(),
      project_id: loaded.project.id,
      import_id: loaded.chapter.id,
      shot_id: loaded.shot.id,
      shot_code: loaded.shot.shot_code || '',
      part: snapshot.part,
      requirement: snapshot.requirement || '',
      fields: fieldMap(snapshot.fields),
      prompts: snapshot.prompts || {},
      score: snapshot.score,
      score_note: snapshot.score_note || '',
    });
  }

  async generatePromptForm(loaded, fields, requirement, part, stop) {
    const map = fieldMap(fields);
    const coverage = String(map.description || '').trim();
    if (!coverage) this.ctx.throw(400, '需要镜头涵盖的剧本内容');
    const sizes = normalizeShotSizes(map.shot_sizes);
    const moves = normalizeCameraMoves(map.camera_moves);
    const durationSec = fitDurationSec(map.duration_sec, map.dialogue, 10);
    const shot = {
      description: coverage,
      duration_sec: durationSec,
      shot_size: serializeShotSizes(sizes),
      shot_sizes: sizes,
      camera_move: serializeCameraMoves(moves),
      camera_moves: moves,
      dialogue: String(map.dialogue || '').trim(),
      source_excerpt: String(map.source_excerpt || '').trim(),
      scene_label: String(map.scene_label || '').trim(),
      wardrobe_state: String(map.wardrobe_state || '').trim(),
      asset_facts: String(map.asset_facts || '').trim(),
      positive_zh: loaded.prompts.positive_zh,
    };
    if (requirement) shot.requirement = requirement;
    const prevText = String(map.prev_shot || '').trim();
    if (prevText && loaded.prev && prevText === prevShotText(loaded.prev)) shot.prev_shot = loaded.prev;
    else if (prevText) shot.prev_shot = { ...(loaded.prev || {}), description: prevText };
    const topics = topicsFromField(map.topics);
    const style = {
      ...styleWithoutBody(loaded.style),
      visual_style_label: String(map.visual_style_label || '').trim(),
      visual_style_prompt: String(map.visual_style_prompt || '').trim(),
      genre: String(map.genre || '').trim(),
      genre_subcategory: String(map.genre_subcategory || '').trim(),
    };
    const promptPayload = {
      requirement,
      standalone_note: '这是单独生成。提示词写完后，reply 只写一行：评分：N。理由：一句话。N 是 1 到 10 的整数，看提示词有没有对准入参、对白有没有漏、时长里能不能做完。',
      asset_facts: shot.asset_facts,
      ...style,
      body: '',
      ...productionInput(loaded.project),
      content_type: String(map.content_type || loaded.project.content_type || '').trim(),
      av_mode: avFromField(map.av_mode),
      topics,
    };
    const parts = part === 'all' ? [ 'positive', 'frame_start', 'frame_end' ] : [ part ];
    const prompts = { ...loaded.prompts };
    const written = {};
    const replies = [];
    const gaps = [];
    const halted = err => err?.status === 499 || err?.message === '已停止' || stop.stopped();
    const requestPart = async (name, current) => {
      if (stop.stopped()) throw stopError();
      this.traceTitle = { positive: '视频提示词', frame_start: '首帧提示词', frame_end: '尾帧提示词' }[name] || name;
      const result = await this.callSkill({
        skill: 'cartoon-prompt-skill',
        action: 'draft',
        timeoutMs: skillTimeout(this.ctx),
        signal: stop.signal,
        payload: { ...promptPayload, prompt_part: name, shots: [ current ] },
      });
      const output = outputOf(result);
      const row = (output.prompts || [])[0] || {};
      row.reply = String(output.reply || output.summary || '').replace(/\s+/g, ' ').trim();
      return row;
    };
    if (parts.includes('positive')) {
      let video = {};
      try {
        video = await requestPart('positive', shot);
      } catch (err) {
        if (halted(err)) throw err;
        gaps.push(err?.message || '没有返回视频提示词');
      }
      replies.push(video.reply);
      const positive = String(video.positive_zh || '').trim();
      if (positive) {
        prompts.positive_zh = picturePrompt(positive) || positive;
        prompts.negative_zh = String(video.negative_zh || prompts.negative_zh || '').trim();
        written.positive_zh = prompts.positive_zh;
        written.negative_zh = prompts.negative_zh;
        shot.positive_zh = prompts.positive_zh;
        const selected = topics;
        const closers = [
          { key: 'av', skill: 'cartoon-av-prompt-skill', title: 'AV 收口' },
          { key: 'fitness', skill: 'cartoon-fitness-prompt-skill', title: '健身收口' },
        ];
        for (const closer of closers) {
          if (!selected.includes(closer.key)) continue;
          try {
            if (stop.stopped()) throw stopError();
            const closed = await this.callSkill({
              skill: closer.skill,
              action: 'draft',
              timeoutMs: skillTimeout(this.ctx),
              signal: stop.signal,
              payload: {
                ...promptPayload,
                prompt_part: 'positive',
                av_mode: selected.includes('av'),
                fitness: selected.includes('fitness'),
                topics: selected,
                shots: [{
                  ...shot,
                  positive_zh: prompts.positive_zh,
                  draft_positive_zh: prompts.positive_zh,
                  draft_negative_zh: prompts.negative_zh,
                  roster_text: rosterText(loaded.chapter.script_data),
                }],
              },
            });
            const again = (outputOf(closed).prompts || [])[0] || {};
            const closedPositive = picturePrompt(again.positive_zh) || String(again.positive_zh || '').trim();
            if (closedPositive) {
              prompts.positive_zh = closedPositive;
              prompts.negative_zh = String(again.negative_zh || prompts.negative_zh || '').trim();
              written.positive_zh = prompts.positive_zh;
              written.negative_zh = prompts.negative_zh;
              shot.positive_zh = closedPositive;
            }
          } catch (err) {
            if (halted(err)) throw err;
            this.ctx.logger.warn('[cartoon] 单独生成%s失败，沿用已写好的提示词 %s', closer.title, err.message);
          }
        }
      } else {
        gaps.push(video.reply ? `没有返回视频提示词。${video.reply.slice(0, 160)}` : '没有返回视频提示词');
      }
    }
    for (const name of parts.filter(item => item !== 'positive')) {
      let row = {};
      try {
        row = await requestPart(name, { ...shot, positive_zh: prompts.positive_zh });
      } catch (err) {
        if (halted(err)) throw err;
        gaps.push(err?.message || '没有返回提示词');
        continue;
      }
      replies.push(row.reply);
      const field = name === 'frame_start' ? 'frame_start_zh' : 'frame_end_zh';
      const text = String(row[field] || '').trim();
      if (!text) {
        gaps.push(row.reply ? `没有返回${name === 'frame_start' ? '首帧' : '尾帧'}提示词。${row.reply.slice(0, 160)}` : '没有返回提示词');
        continue;
      }
      prompts[field] = picturePrompt(text) || text;
      written[field] = prompts[field];
    }
    const asked = parts.map(name => (name === 'positive' ? 'positive_zh' : (name === 'frame_start' ? 'frame_start_zh' : 'frame_end_zh')));
    if (!asked.some(key => written[key])) this.ctx.throw(502, gaps[0] || '没有返回提示词');
    const saved = await this.saveFormPrompts(loaded.shot.id, written);
    const shotPatch = {
      description: shot.description,
      dialogue: shot.dialogue,
      scene_label: shot.scene_label,
      shot_size: shot.shot_size,
      camera_move: shot.camera_move,
      duration_ms: durationSec * 1000,
      source_excerpt: shot.source_excerpt,
    };
    if (shot.wardrobe_state) shotPatch.wardrobe_state = shot.wardrobe_state;
    try {
      await loaded.shot.update(shotPatch);
    } catch (err) {
      if (!shotPatch.wardrobe_state || !/wardrobe_state|source_excerpt/i.test(String(err.message || ''))) throw err;
      delete shotPatch.wardrobe_state;
      delete shotPatch.source_excerpt;
      await loaded.shot.update(shotPatch);
    }
    const scored = readScoreText(replies.filter(Boolean).join('\n'));
    return {
      prompts: saved,
      score: scored.score,
      score_note: scored.score_note,
      warning: gaps.filter(Boolean).join('；'),
    };
  }

  /** @deprecated 兼容旧「一次三步」入口，改为只生成剧本 */
  async suggest(projectId, importId) {
    return this.suggestScript(projectId, importId);
  }

  async apply(projectId, importId, payload) {
    if (payload && payload.script_data && !Array.isArray(payload.shots)) {
      return this.applyScript(projectId, importId, payload);
    }
    if (payload && payload.script_data && Array.isArray(payload.shots) && payload.shots.length) {
      await this.applyScript(projectId, importId, payload);
      this.ctx.throw(400, '请改用剧本页「拆分分镜」与单行生成，不再一次写入全部分镜');
    }
    return this.applyScript(projectId, importId, payload);
  }

  async run(projectId, importId) {
    const draft = await this.suggestScript(projectId, importId);
    return this.applyScript(projectId, importId, draft);
  }

  async describeAsset(projectId, payload = {}, options = {}) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const kind = [ 'character', 'scene', 'prop' ].includes(payload.kind) ? payload.kind : '';
    const name = String(payload.name || '').trim();
    if (!kind || !name) this.ctx.throw(400, '先写资产名称和类型');
    const style = await this.styleContext(project);
    const stop = options.signal
      ? { signal: options.signal, release() {} }
      : clientAbort(this.ctx);
    let result;
    try {
      result = await invokeSkill(this.ctx, {
        skill: 'cartoon-asset-desc-skill',
        action: 'draft',
        signal: stop.signal,
        payload: {
          kind,
          name,
          notes: String(payload.notes || '').trim(),
          costume_note: String(payload.costume_note || '').trim(),
          visual_style: style.visual_style,
          visual_style_label: style.visual_style_label,
          visual_style_prompt: style.visual_style_prompt,
          style_ids: style.style_ids || [],
          genre: [ style.genre, style.genre_subcategory, style.novel_type ].filter(Boolean).join(' / '),
          title: style.title,
          av_nude: payload.av_nude === true,
        },
      });
    } finally {
      stop.release();
    }
    const output = outputOf(result);
    const description = stripSheetLayout(output.description || output.prompt || output.reply || '');
    if (!description) this.ctx.throw(502, '没有生成资产描述');
    return { description, kind };
  }
}

function stripSheetLayout(text) {
  return String(text || '')
    .replace(/纯白背景[^。\n]{0,80}三视图[^。\n]*[。]?/g, '')
    .replace(/同一场景[^。\n]{0,80}(?:多视角|俯视)[^。\n]*[。]?/g, '')
    .replace(/画面里禁止出现人物[^。\n]*[。]?/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = DraftService;
