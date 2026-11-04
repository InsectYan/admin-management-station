'use strict';

const Service = require('egg').Service;
const { invokeSkill } = require('../lib/agentProxy');
const { productionInput } = require('../lib/productionInput');
const {
  SHOT_SIZES,
  CAMERA_MOVES,
  styleOf,
  stylePromptOf,
  styleLabelOf,
  detectXianxia,
} = require('../lib/cartoonMeta');

function outputOf(result) {
  return result?.output || {};
}

function skillTimeout(ctx) {
  return Number(ctx.app.config.agentPlatform?.timeoutMs) || 600000;
}

function clampDurationSec(value, fallback = 10) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(15, Math.max(8, Math.round(n)));
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
      body: String(chapter?.body || '').slice(0, 20000),
    };
    return {
      ...payload,
      is_xianxia: detectXianxia(payload),
    };
  }

  /** 只生成完整剧本，不拆分镜、不写提示词 */
  async suggestScript(projectId, importId) {
    const { project, chapter } = await this.load(projectId, importId);
    const styleCtx = await this.styleContext(project, chapter);
    const scriptResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-script-skill',
      action: 'draft',
      timeoutMs: skillTimeout(this.ctx),
      payload: {
        chapter_title: chapter.chapter_title || '',
        body: chapter.body,
        ...styleCtx,
        ...productionInput(project),
      },
    });
    const scriptData = outputOf(scriptResult).script_data;
    if (!scriptData || !Array.isArray(scriptData.scenes) || !scriptData.scenes.length) {
      this.ctx.throw(502, '剧本没有返回场次');
    }
    return {
      script_data: scriptData,
      is_xianxia: styleCtx.is_xianxia,
      visual_style_label: styleCtx.visual_style_label,
      persisted: false,
    };
  }

  async applyScript(projectId, importId, payload) {
    const { chapter } = await this.load(projectId, importId);
    const scriptData = payload.script_data;
    if (!scriptData || !Array.isArray(scriptData.scenes) || !scriptData.scenes.length) {
      this.ctx.throw(400, '需要场次');
    }
    await chapter.update({
      script_data: scriptData,
      characters: scriptData.characters || [],
    });
    return this.ctx.service.project.show(projectId);
  }

  /** 按已有剧本拆镜头大纲：每镜只描述涵盖的剧本内容，不写提示词、不落库 */
  async suggestShotOutline(projectId, importId) {
    const { project, chapter } = await this.load(projectId, importId);
    const scriptData = chapter.script_data;
    if (!scriptData || !Array.isArray(scriptData.scenes) || !scriptData.scenes.length) {
      this.ctx.throw(400, '请先生成并保存剧本');
    }
    const styleCtx = await this.styleContext(project, chapter);
    const boardResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-storyboard-skill',
      action: 'draft',
      timeoutMs: skillTimeout(this.ctx),
      payload: {
        script_data: scriptData,
        body: chapter.body,
        outline_only: true,
        ...styleCtx,
        ...productionInput(project),
      },
    });
    const shots = outputOf(boardResult).shots;
    if (!Array.isArray(shots) || !shots.length) this.ctx.throw(502, '没有返回镜头大纲');
    return {
      script_data: scriptData,
      outline: shots.map((item, index) => ({
        index,
        coverage: String(item.description || '').trim(),
        duration_sec: clampDurationSec(item.duration_sec, 10),
        shot_size: SHOT_SIZES.includes(item.shot_size) ? item.shot_size : '中景',
        camera_move: CAMERA_MOVES.includes(item.camera_move) ? item.camera_move : '固定',
        dialogue: String(item.dialogue || '').trim(),
      })).filter(item => item.coverage),
      persisted: false,
    };
  }

  /** 单行大纲 → 完整分镜 + 提示词，并写入该快照的一条镜头 */
  async expandShot(projectId, importId, payload) {
    const { project, chapter } = await this.load(projectId, importId);
    const scriptData = chapter.script_data || payload.script_data;
    if (!scriptData || !Array.isArray(scriptData.scenes) || !scriptData.scenes.length) {
      this.ctx.throw(400, '请先生成并保存剧本');
    }
    const coverage = String(payload.coverage || payload.description || '').trim();
    if (!coverage) this.ctx.throw(400, '需要镜头涵盖的剧本内容');
    const durationSec = clampDurationSec(payload.duration_sec, 10);
    const styleCtx = await this.styleContext(project, chapter);
    const seedShot = {
      description: coverage,
      duration_sec: durationSec,
      shot_size: SHOT_SIZES.includes(payload.shot_size) ? payload.shot_size : '中景',
      camera_move: CAMERA_MOVES.includes(payload.camera_move) ? payload.camera_move : '固定',
      dialogue: String(payload.dialogue || '').trim(),
    };
    const boardResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-storyboard-skill',
      action: 'draft',
      timeoutMs: skillTimeout(this.ctx),
      payload: {
        script_data: scriptData,
        body: chapter.body,
        expand_one: true,
        seed_shot: seedShot,
        ...styleCtx,
        ...productionInput(project),
      },
    });
    const expanded = (outputOf(boardResult).shots || [])[0];
    const shot = {
      description: String(expanded?.description || seedShot.description).trim(),
      duration_sec: clampDurationSec(expanded?.duration_sec, durationSec),
      shot_size: SHOT_SIZES.includes(expanded?.shot_size) ? expanded.shot_size : seedShot.shot_size,
      camera_move: CAMERA_MOVES.includes(expanded?.camera_move) ? expanded.camera_move : seedShot.camera_move,
      dialogue: String(expanded?.dialogue || seedShot.dialogue).trim(),
    };
    if (!shot.description) this.ctx.throw(502, '没有返回分镜描述');
    const promptResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-prompt-skill',
      action: 'draft',
      timeoutMs: skillTimeout(this.ctx),
      payload: {
        shots: [ shot ],
        ...styleCtx,
        ...productionInput(project),
      },
    });
    const prompt = (outputOf(promptResult).prompts || [])[0] || {};
    const max = await this.ctx.model.Shot.max('sort_order', { where: { project_id: project.id } });
    const order = Number.isFinite(max) ? max + 1 : 0;
    const created = await this.ctx.model.Shot.create({
      project_id: project.id,
      import_id: chapter.id,
      sort_order: order,
      shot_size: shot.shot_size,
      camera_move: shot.camera_move,
      description: shot.description,
      dialogue: shot.dialogue,
      duration_ms: shot.duration_sec * 1000,
    });
    await this.ctx.model.Prompt.create({
      shot_id: created.id,
      positive_zh: prompt.positive_zh || shot.description,
      negative_zh: prompt.negative_zh || '',
    });
    return this.ctx.service.project.show(project.id);
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
      this.ctx.throw(400, '请改用剧本页「生成镜头」与单行生成，不再一次写入全部分镜');
    }
    return this.applyScript(projectId, importId, payload);
  }

  async run(projectId, importId) {
    const draft = await this.suggestScript(projectId, importId);
    return this.applyScript(projectId, importId, draft);
  }
}

module.exports = DraftService;
