'use strict';

const Service = require('egg').Service;
const { invokeSkill } = require('../lib/agentProxy');
const { clientAbort, stopError } = require('../lib/clientAbort');
const { productionInput } = require('../lib/productionInput');
const {
  styleOf,
  stylePromptOf,
  styleLabelOf,
  detectXianxia,
  normalizeShotSizes,
  serializeShotSizes,
  normalizeCameraMoves,
  serializeCameraMoves,
} = require('../lib/cartoonMeta');
const { minStoryUnits, normalizeOmissions, uncoveredScenes } = require('../lib/storyCoverage');
const { normalizeScript } = require('../lib/rosterNames');
const { uniquePrompt } = require('../lib/promptText');
const { begin, finish } = require('../lib/activeRuns');

function outputOf(result) {
  return result?.output || {};
}

function picturePrompt(text) {
  return uniquePrompt(text);
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
  return Number(ctx.app.config.agentPlatform?.timeoutMs) || 960000;
}

function clampDurationSec(value, fallback = 10) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(15, Math.max(8, Math.round(n)));
}

function negativeNeedsRetry(prompt) {
  const negative = String(prompt?.negative_zh || '').trim();
  if (!negative) return true;
  return negative.length < 80 && /拦截|违规|敏感|无法提供|不能生成|内容安全/.test(negative);
}

class DraftService extends Service {
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
    const visualStyle = project.visual_style || '';
    const hit = styleOf(visualStyle);
    const payload = {
      visual_style: visualStyle,
      visual_style_label: styleLabelOf(visualStyle) || hit?.label || '',
      visual_style_prompt: stylePromptOf(visualStyle) || '',
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

  async composeScript(projectId, importId, signal) {
    const { project, chapter } = await this.load(projectId, importId);
    const styleCtx = await this.styleContext(project, chapter);
    const bodyLen = String(chapter.body || '').length;
    const minScenes = minStoryUnits(bodyLen);
    const scriptResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-script-skill',
      action: 'draft',
      timeoutMs: skillTimeout(this.ctx),
      signal,
      payload: {
        chapter_title: chapter.chapter_title || '',
        ...styleCtx,
        ...productionInput(project),
        body: chapter.body,
        min_scenes: minScenes,
      },
    });
    const scriptOutput = outputOf(scriptResult);
    const scriptData = scriptOutput.script_data;
    if (!scriptData || !Array.isArray(scriptData.scenes) || !scriptData.scenes.length) {
      const reply = String(scriptOutput.reply || scriptOutput.summary || '').replace(/\s+/g, ' ').trim();
      this.ctx.throw(502, reply ? `剧本没有返回场次。${reply.slice(0, 160)}` : '剧本没有返回场次');
    }
    const omissions = normalizeOmissions(scriptData.omissions);
    if (scriptData.scenes.length < minScenes && !omissions.length) {
      omissions.push({
        target: '场次',
        reason: `本章约 ${bodyLen} 字，场次下限是 ${minScenes}，本次只写出 ${scriptData.scenes.length} 场，其余情节被合并或删掉。`,
      });
    }
    scriptData.omissions = omissions;
    scriptData.shot_omissions = [];
    const named = normalizeScript(scriptData);
    await chapter.update({
      script_data: { ...named, shot_omissions: [] },
      characters: named.characters || [],
    });
    return {
      script_data: named,
      is_xianxia: styleCtx.is_xianxia,
      visual_style_label: styleCtx.visual_style_label,
      persisted: true,
    };
  }

  async applyScript(projectId, importId, payload) {
    const { chapter } = await this.load(projectId, importId);
    const scriptData = normalizeScript(payload.script_data);
    if (!scriptData || !Array.isArray(scriptData.scenes) || !scriptData.scenes.length) {
      this.ctx.throw(400, '需要场次');
    }
    await chapter.update({
      script_data: { ...scriptData, shot_omissions: [] },
      characters: scriptData.characters || [],
    });
    return this.ctx.service.project.show(projectId);
  }

  /** 按已有剧本拆镜头大纲并落库；与镜头页共用同一批 Shot */
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
    const styleCtx = await this.styleContext(project, chapter);
    const bodyLen = String(chapter.body || '').length;
    const minShots = Math.max(minStoryUnits(bodyLen), scriptData.scenes.length);
    const boardResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-storyboard-skill',
      action: 'draft',
      timeoutMs: skillTimeout(this.ctx),
      signal,
      payload: {
        script_data: scriptData,
        outline_only: true,
        ...styleCtx,
        ...productionInput(project),
        body: chapter.body,
        min_shots: minShots,
      },
    });
    const boardOutput = outputOf(boardResult);
    const rawShots = boardOutput.shots;
    if (!Array.isArray(rawShots) || !rawShots.length) this.ctx.throw(502, '没有返回镜头大纲');
    const outline = rawShots.map((item, index) => ({
      index,
      scene_index: Number.isInteger(Number(item.scene_index)) && Number(item.scene_index) > 0 ? Number(item.scene_index) : undefined,
      coverage: String(item.description || item.coverage || item.summary || '').trim(),
      duration_sec: clampDurationSec(item.duration_sec, 10),
      shot_size: serializeShotSizes(item.shot_sizes != null ? item.shot_sizes : item.shot_size),
      camera_move: serializeCameraMoves(item.camera_moves != null ? item.camera_moves : item.camera_move),
      dialogue: String(item.dialogue || '').trim(),
    })).filter(item => item.coverage);
    if (!outline.length) this.ctx.throw(502, '没有有效镜头大纲');
    const shotOmissions = normalizeOmissions(boardOutput.omissions);
    const missingScenes = uncoveredScenes(scriptData.scenes, outline.map(item => ({
      description: item.coverage,
      scene_index: item.scene_index,
    })));
    if (missingScenes.length) {
      shotOmissions.push({
        target: missingScenes.map(item => `第${item.index}场`).join('、'),
        reason: `${missingScenes.map(item => `第${item.index}场${item.title ? `「${item.title}」` : ''}`).join('、')}没有单独的镜头，被并进了其他场。一场可以拆成多条镜头，但不能少场。`,
      });
    } else if (outline.length < scriptData.scenes.length && !shotOmissions.length) {
      shotOmissions.push({
        target: '分镜',
        reason: `剧本有 ${scriptData.scenes.length} 场，本次只拆出 ${outline.length} 条镜头，少掉的场次被合并或跳过。`,
      });
    } else if (outline.length < minShots && !shotOmissions.length) {
      shotOmissions.push({
        target: '分镜',
        reason: `本章约 ${bodyLen} 字，镜头下限是 ${minShots}，本次只拆出 ${outline.length} 条。`,
      });
    }
    await chapter.update({
      script_data: { ...scriptData, shot_omissions: shotOmissions },
    });

    if (existing.length) {
      await this.ctx.service.project.destroyShotsByIds(existing.map(item => item.id));
    }

    const episode = await this.ctx.service.project.ensureEpisode(projectPk);
    const maxOrder = await this.ctx.model.Shot.max('sort_order', { where: { project_id: projectPk } });
    let order = Number.isFinite(maxOrder) ? maxOrder + 1 : 0;
    const codes = await this.ctx.service.project.allocateShotCodes(projectPk, outline.length);
    const createdIds = [];
    for (let i = 0; i < outline.length; i += 1) {
      const item = outline[i];
      const base = {
        project_id: projectPk,
        import_id: importPk,
        video_task_id: episode.id,
        sort_order: order,
        shot_size: item.shot_size,
        camera_move: item.camera_move,
        description: item.coverage,
        dialogue: item.dialogue,
        duration_ms: item.duration_sec * 1000,
      };
      let row;
      try {
        row = await this.ctx.model.Shot.create({ ...base, shot_code: codes[i] });
      } catch (err) {
        if (!/shot_code/i.test(String(err.message || ''))) throw err;
        this.ctx.logger.warn('[cartoon] shot_code column missing, create without code: %s', err.message);
        row = await this.ctx.model.Shot.create(base);
      }
      createdIds.push(row.id);
      order += 1;
    }
    await this.ctx.service.project.ensureShotCodes(projectPk);
    this.ctx.logger.info('[cartoon] shot-outline import=%s created=%s codes=%j', importPk, createdIds.length, codes);
    const verified = await this.ctx.model.Shot.count({ where: { project_id: projectPk, import_id: importPk } });
    if (verified < 1) this.ctx.throw(502, '分镜写入后查询为空，请检查数据库');
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
    const durationSec = clampDurationSec(
      payload.duration_sec != null ? payload.duration_sec : (existing.duration_ms ? existing.duration_ms / 1000 : 10),
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
    const seedShot = {
      description: coverage,
      duration_sec: durationSec,
      shot_size: serializeShotSizes(seedSizes),
      shot_sizes: seedSizes,
      camera_move: serializeCameraMoves(seedMoves),
      camera_moves: seedMoves,
      dialogue: String(payload.dialogue != null ? payload.dialogue : (existing.dialogue || '')).trim(),
    };
    const ensureRunning = () => {
      if (stop.stopped()) throw stopError();
    };
    let boardResult;
    try {
      ensureRunning();
      boardResult = await invokeSkill(this.ctx, {
        skill: 'cartoon-storyboard-skill',
        action: 'draft',
        timeoutMs: skillTimeout(this.ctx),
        signal: stop.signal,
        payload: {
          script_data: scriptData,
          body: chapter.body,
          expand_one: true,
          seed_shot: seedShot,
          ...styleCtx,
          ...productionInput(project),
        },
      });
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
      duration_sec: clampDurationSec(expanded?.duration_sec, durationSec),
      shot_size: serializeShotSizes(expandedSizes),
      shot_sizes: expandedSizes,
      camera_move: serializeCameraMoves(expandedMoves),
      camera_moves: expandedMoves,
      dialogue: String(expanded?.dialogue || seedShot.dialogue).trim(),
    };
    if (!shot.description) this.ctx.throw(502, '没有返回分镜描述');
    const promptPayload = {
      shots: [ shot ],
      body: chapter.body,
      ...styleCtx,
      ...productionInput(project),
    };
    ensureRunning();
    const promptResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-prompt-skill',
      action: 'draft',
      timeoutMs: skillTimeout(this.ctx),
      signal: stop.signal,
      payload: promptPayload,
    });
    const promptOutput = outputOf(promptResult);
    let prompt = (promptOutput.prompts || [])[0] || {};
    const positive = String(prompt.positive_zh || '').trim();
    if (!positive) {
      const reply = String(promptOutput.reply || promptOutput.summary || '').replace(/\s+/g, ' ').trim();
      this.ctx.throw(502, reply ? `没有返回正向提示词。${reply.slice(0, 160)}` : '没有返回正向提示词');
    }
    if (negativeNeedsRetry(prompt)) {
      try {
        ensureRunning();
        const retry = await invokeSkill(this.ctx, {
          skill: 'cartoon-prompt-skill',
          action: 'draft',
          timeoutMs: skillTimeout(this.ctx),
          signal: stop.signal,
          payload: {
            ...promptPayload,
            shots: [{ ...shot, positive_zh: positive, negative_only: true }],
          },
        });
        const again = String((outputOf(retry).prompts || [])[0]?.negative_zh || '').trim();
        if (again) prompt = { ...prompt, negative_zh: again };
      } catch (err) {
        if (err?.status === 499 || err?.message === '已停止') throw err;
        this.ctx.logger.warn('[cartoon] 负向提示词补调失败 %s', err.message);
      }
    }
    if (project.av_mode) {
      ensureRunning();
      const closed = await invokeSkill(this.ctx, {
        skill: 'cartoon-av-prompt-skill',
        action: 'draft',
        timeoutMs: skillTimeout(this.ctx),
        signal: stop.signal,
        payload: {
          ...promptPayload,
          shots: [{
            ...shot,
            draft_positive_zh: picturePrompt(prompt.positive_zh),
            draft_negative_zh: String(prompt.negative_zh || '').trim(),
            draft_production_note: String(prompt.production_note || '').trim(),
          }],
        },
      });
      const again = (outputOf(closed).prompts || [])[0] || {};
      const closedPositive = picturePrompt(again.positive_zh);
      if (!closedPositive) this.ctx.throw(502, 'AV 收口没有返回画面提示词');
      prompt = {
        ...prompt,
        positive_zh: closedPositive,
        negative_zh: String(again.negative_zh || prompt.negative_zh || '').trim(),
        production_note: String(again.production_note || prompt.production_note || '').trim(),
      };
    }
    ensureRunning();
    const overrides = (Array.isArray(existing.overridden_fields) ? existing.overridden_fields : [])
      .filter(field => field !== 'assets');
    await existing.update({
      shot_size: shot.shot_size,
      camera_move: shot.camera_move,
      dialogue: shot.dialogue,
      duration_ms: shot.duration_sec * 1000,
      overridden_fields: overrides,
    });
    const promptRow = await this.ctx.model.Prompt.findOne({ where: { shot_id: existing.id } });
    if (promptRow) {
      await promptRow.update({
        positive_zh: picturePrompt(prompt.positive_zh) || shot.description,
        negative_zh: prompt.negative_zh || '',
      });
    } else {
      await this.ctx.model.Prompt.create({
        shot_id: existing.id,
        positive_zh: picturePrompt(prompt.positive_zh) || shot.description,
        negative_zh: prompt.negative_zh || '',
      });
    }
    await this.ctx.service.project.bindMatchedAssets(project.id, existing.id, [
      picturePrompt(prompt.positive_zh) || shot.description,
      prompt.negative_zh || '',
      shot.description,
      shot.dialogue,
      ...coveredPlaceNames(scriptData, `${shot.description}\n${picturePrompt(prompt.positive_zh)}`),
    ].join('\n'));
      const result = await this.ctx.service.project.show(project.id);
      finish(this.app, claim.row, null, result);
      return result;
    } catch (err) {
      finish(this.app, claim.row, err);
      throw err;
    } finally {
      stop.release();
    }
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
}

module.exports = DraftService;
