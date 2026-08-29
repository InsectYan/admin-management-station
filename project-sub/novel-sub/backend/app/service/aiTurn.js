'use strict';

const { withFormattedTimes } = require('../lib/formatDateTime');
const { resolveScene } = require('../lib/aiSceneRegistry');
const { invokeSkill, invokeSkillStream, newTraceId } = require('../lib/agentProxy');
const {
  GENERATABLE_FIELDS,
  filterGeneratableFields,
  fieldInSceneAllow,
  slimCatalog,
  sanitizePatch,
  outlineWordWarning,
  unwrapSkill,
  peelAssistantText,
  peelThinkingText,
  digestHistory,
} = require('../lib/aiPatchSanitize');
const { coverageFromNovel } = require('../lib/aiPlan');

function toPublicMessage(row) {
  return withFormattedTimes(row);
}

function extractThinkBlocks(raw) {
  return [...String(raw || '').matchAll(/<think>([\s\S]*?)<\/think>/gi)]
    .map((m) => m[1].trim())
    .filter(Boolean)
    .join('\n\n');
}

function salvageThinking(parsedThinking, streamed) {
  const fromJson = peelThinkingText(parsedThinking);
  if (fromJson) return fromJson;
  const fromStream = peelThinkingText(streamed);
  if (fromStream) return fromStream;
  const fromTags = extractThinkBlocks(streamed);
  if (fromTags) return fromTags;
  const beforeJson = String(streamed || '').split('{')[0].trim();
  return beforeJson.slice(0, 4000);
}

function throwIfEmptyTargets(targetFields) {
  if (targetFields.length) return;
  const err = new Error('当前场景没有可生成的文本字段');
  err.status = 400;
  err.code = 'SCENE_STRUCTURAL';
  throw err;
}

class AiTurnService extends require('egg').Service {
  async prepare(sessionId, body = {}) {
    const session = await this.ctx.service.aiSession.get(sessionId);
    const spec = resolveScene(body.scene);
    const message = String(body.message || '').trim();
    if (!message) {
      const err = new Error('请输入想让 AI 帮忙的内容');
      err.status = 400;
      err.code = 'MESSAGE_REQUIRED';
      throw err;
    }

    if (spec.require_novel_id && !session.novel_id) {
      const err = new Error('请先保存基础信息');
      err.status = 400;
      err.code = 'NOVEL_REQUIRED';
      throw err;
    }

    const sceneAllow = spec.default_target_fields || GENERATABLE_FIELDS;
    const requested = Array.isArray(body.target_fields) && body.target_fields.length
      ? body.target_fields
      : sceneAllow;
    const targetFields = filterGeneratableFields(
      requested.filter((key) => fieldInSceneAllow(key, sceneAllow)),
    );
    throwIfEmptyTargets(targetFields);

    const catalog = slimCatalog(await this.ctx.service.novelEnum.tree());
    const historyRows = await this.ctx.service.aiSession.listMessages(session.id);
    const boundContext = body.form_snapshot && typeof body.form_snapshot === 'object'
      ? { ...body.form_snapshot }
      : { ...(session.bound_context_json || {}) };

    if (spec.feature_key === 'orchestrate') {
      let coverage = boundContext.coverage;
      if (!coverage && session.novel_id) {
        const novel = await this.ctx.service.novel.findById(session.novel_id);
        const setting = novel ? await this.ctx.service.novel.getSetting(session.novel_id) : {};
        coverage = coverageFromNovel(novel, setting || {});
      }
      boundContext.coverage = coverage || {
        basic: false, world: false, characters: false, outline: false, content: false,
      };
    }

    return {
      session,
      spec,
      message,
      targetFields,
      catalog,
      history: digestHistory(historyRows),
      boundContext,
      timeoutMs: this.ctx.app.config.agentPlatform?.timeoutMs || 180000,
      traceId: newTraceId(),
    };
  }

  async persistTurn({ session, spec, message, targetFields, traceId, brainstorm, writer, patch, thinkingText, reply }) {
    const userRow = await this.ctx.service.aiSession.addMessage(session.id, {
      role: 'user',
      content: message,
      target_fields_json: targetFields,
      scene: spec.scene,
      trace_id: traceId,
    });

    let thinkingRow = null;
    if (thinkingText) {
      thinkingRow = await this.ctx.service.aiSession.addMessage(session.id, {
        role: 'thinking',
        content: thinkingText,
        scene: spec.scene,
        trace_id: traceId,
      });
    }

    const assistantRow = await this.ctx.service.aiSession.addMessage(session.id, {
      role: 'assistant',
      content: reply,
      target_fields_json: writer.target_fields.length
        ? filterGeneratableFields(writer.target_fields).filter((key) => targetFields.includes(key))
        : targetFields,
      patch_json: patch,
      scene: spec.scene,
      trace_id: traceId,
    });

    return {
      session_id: session.id,
      scene: spec.scene,
      trace_id: traceId,
      target_fields: targetFields,
      patch,
      reply,
      thinking: thinkingText,
      sparks: brainstorm.sparks,
      messages: [userRow, thinkingRow, assistantRow].filter(Boolean).map(toPublicMessage),
    };
  }

  async run(sessionId, body = {}) {
    const ctx = await this.prepare(sessionId, body);
    const { session, spec, message, targetFields, catalog, history, boundContext, timeoutMs, traceId } = ctx;

    let brainstorm = { reply: '', thinking: '', sparks: [] };
    const writerStep = spec.pipeline.find((step) => step.skill === 'novel-writer-skill')
      || spec.pipeline[spec.pipeline.length - 1];
    const brainstormStep = spec.pipeline.find((step) => step.skill === 'novel-brainstorm-skill');

    if (brainstormStep) {
      const invoked = await invokeSkill(this.ctx, {
        skill: brainstormStep.skill,
        action: brainstormStep.action,
        timeoutMs,
        payload: {
          trace_id: `${traceId}-brainstorm`,
          topic: message,
          user_message: message,
          scene: spec.scene,
          focus: brainstormStep.focus || 'auto',
          target_fields: targetFields,
          bound_context: boundContext,
          catalog,
          history,
        },
      });
      brainstorm = unwrapSkill(invoked.data);
    }

    const writerInvoked = await invokeSkill(this.ctx, {
      skill: writerStep.skill,
      action: writerStep.action,
      timeoutMs,
      payload: {
        trace_id: `${traceId}-writer`,
        topic: message,
        user_message: message,
        scene: spec.scene,
        target_fields: targetFields,
        bound_context: boundContext,
        catalog,
        history,
        sparks: brainstorm.sparks,
        brainstorm_reply: brainstorm.reply,
        brainstorm_thinking: brainstorm.thinking,
      },
    });
    const notices = [];
    const writer = unwrapSkill(writerInvoked.data);
    const patch = sanitizePatch(writer.patch, catalog, targetFields, notices, {
      coverage: boundContext.coverage,
    });
    const lengthId = boundContext.basic?.length_id || boundContext.length_id;
    const wordWarn = outlineWordWarning(patch.volumes, catalog, lengthId);
    if (wordWarn) notices.push(wordWarn);
    const thinkingText = [brainstorm.thinking, writer.thinking].filter(Boolean).join('\n\n').trim();
    const fallback = Array.isArray(patch.tasks) && patch.tasks.length
      ? '已拆好开书计划，可执行下一步。'
      : '已生成一稿，可应用到表单。';
    const reply = [peelAssistantText(writer.reply) || peelAssistantText(brainstorm.reply) || fallback, ...notices]
      .filter(Boolean)
      .join('\n\n');

    return this.persistTurn({
      session, spec, message, targetFields, traceId, brainstorm, writer, patch, thinkingText, reply,
    });
  }

  async runStream(sessionId, body, emit) {
    const ctx = await this.prepare(sessionId, body);
    const { session, spec, message, targetFields, catalog, history, boundContext, timeoutMs, traceId } = ctx;

    emit('status', { phase: 'start', label: '开始构思…' });

    let streamed = '';
    const forwardThinking = (event, data, skillLabel) => {
      if (event === 'delta') {
        const piece = data?.delta || '';
        if (piece) {
          streamed += piece;
          emit('thinking', { text: streamed, delta: piece, skill: skillLabel });
        }
        return;
      }
      if (event === 'status') {
        const phase = data?.phase;
        if (phase === 'prompt' || phase === 'done') return;
        const label = data?.label || data?.thinking || '';
        if (label && ['init', 'llm', 'loop'].includes(phase)) {
          emit('thinking', { label, phase, skill: skillLabel, text: streamed });
        }
      }
    };

    let brainstorm = { reply: '', thinking: '', sparks: [] };
    const writerStep = spec.pipeline.find((step) => step.skill === 'novel-writer-skill')
      || spec.pipeline[spec.pipeline.length - 1];
    const brainstormStep = spec.pipeline.find((step) => step.skill === 'novel-brainstorm-skill');

    if (brainstormStep) {
      emit('thinking', { label: '林间灵感思考中…', phase: 'brainstorm', text: streamed });
      const invoked = await invokeSkillStream(this.ctx, {
        skill: brainstormStep.skill,
        action: brainstormStep.action,
        timeoutMs,
        payload: {
          trace_id: `${traceId}-brainstorm`,
          topic: message,
          user_message: message,
          scene: spec.scene,
          focus: brainstormStep.focus || 'auto',
          target_fields: targetFields,
          bound_context: boundContext,
          catalog,
          history,
        },
        onEvent: (event, data) => forwardThinking(event, data, 'brainstorm'),
      });
      brainstorm = unwrapSkill(invoked.data);
      streamed += streamed && !streamed.endsWith('\n') ? '\n\n' : '';
    }

    emit('thinking', { label: '林间写手落笔中…', phase: 'writer', text: streamed });
    const writerInvoked = await invokeSkillStream(this.ctx, {
      skill: writerStep.skill,
      action: writerStep.action,
      timeoutMs,
      payload: {
        trace_id: `${traceId}-writer`,
        topic: message,
        user_message: message,
        scene: spec.scene,
        target_fields: targetFields,
        bound_context: boundContext,
        catalog,
        history,
        sparks: brainstorm.sparks,
        brainstorm_reply: brainstorm.reply,
        brainstorm_thinking: brainstorm.thinking,
      },
      onEvent: (event, data) => forwardThinking(event, data, 'writer'),
    });
    const notices = [];
    const writer = unwrapSkill(writerInvoked.data);
    const patch = sanitizePatch(writer.patch, catalog, targetFields, notices, {
      coverage: boundContext.coverage,
    });
    const lengthId = boundContext.basic?.length_id || boundContext.length_id;
    const wordWarn = outlineWordWarning(patch.volumes, catalog, lengthId);
    if (wordWarn) notices.push(wordWarn);
    const thinkingText = [brainstorm.thinking, writer.thinking].filter(Boolean).join('\n\n').trim()
      || salvageThinking('', streamed);
    const fallback = Array.isArray(patch.tasks) && patch.tasks.length
      ? '已拆好开书计划，可执行下一步。'
      : '已生成一稿，可应用到表单。';
    const reply = [peelAssistantText(writer.reply) || peelAssistantText(brainstorm.reply) || fallback, ...notices]
      .filter(Boolean)
      .join('\n\n');

    const result = await this.persistTurn({
      session, spec, message, targetFields, traceId, brainstorm, writer, patch, thinkingText, reply,
    });
    emit('done', result);
    return result;
  }
}

module.exports = AiTurnService;
