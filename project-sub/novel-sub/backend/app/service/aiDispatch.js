'use strict';

const { PLAN_BY_PATH, findTask, assertDependencies, markTaskStatus } = require('../lib/aiPlan');

class AiDispatchService extends require('egg').Service {
  async lastPlan(session) {
    const rows = await this.ctx.service.aiSession.listMessages(session.id);
    const assistant = [...rows].reverse().find((row) => (
      row.role === 'assistant' && Array.isArray(row.patch_json?.tasks) && row.patch_json.tasks.length
    ));
    if (!assistant) {
      const err = new Error('请先生成开书计划');
      err.status = 400;
      err.code = 'PLAN_REQUIRED';
      throw err;
    }
    return assistant;
  }

  async ensureTargetSession(planSession, def, novelId) {
    if (novelId) {
      const listed = await this.ctx.service.aiSession.list({
        novel_id: novelId,
        feature_key: def.feature_key,
      });
      if (listed.length) {
        const bound = listed[0];
        const ctxJson = bound.bound_context_json && typeof bound.bound_context_json === 'object'
          ? bound.bound_context_json
          : {};
        if (!ctxJson.parent_plan_session_id) {
          await this.ctx.service.aiSession.update(bound.id, {
            bound_context_json: { ...ctxJson, parent_plan_session_id: planSession.id },
          });
        }
        return this.ctx.service.aiSession.get(bound.id);
      }
    }
    return this.ctx.service.aiSession.create({
      feature_key: def.feature_key,
      novel_id: novelId || null,
      title: def.label || def.feature_key,
      bound_context_json: { parent_plan_session_id: planSession.id },
    });
  }

  async dispatch(body = {}) {
    const planSessionId = body.plan_session_id || body.session_id;
    if (!planSessionId) {
      const err = new Error('缺少 plan_session_id');
      err.status = 400;
      err.code = 'PLAN_SESSION_REQUIRED';
      throw err;
    }
    const planSession = await this.ctx.service.aiSession.get(planSessionId);
    if (planSession.feature_key !== 'orchestrate') {
      const err = new Error('不是开书计划会话');
      err.status = 400;
      err.code = 'NOT_PLAN_SESSION';
      throw err;
    }

    const planMessage = await this.lastPlan(planSession);
    const tasks = planMessage.patch_json.tasks;
    const task = findTask(tasks, { task_id: body.task_id, task_path: body.task_path });
    if (!task) {
      const err = new Error('计划里没有可执行的任务');
      err.status = 400;
      err.code = 'TASK_NOT_FOUND';
      throw err;
    }
    if (task.status === 'skip') {
      const err = new Error('该步已有内容，默认跳过');
      err.status = 409;
      err.code = 'TASK_SKIPPED';
      throw err;
    }
    assertDependencies(tasks, task);

    const def = PLAN_BY_PATH.get(task.path);
    if (!def) {
      const err = new Error('未知任务');
      err.status = 400;
      err.code = 'TASK_NOT_FOUND';
      throw err;
    }

    let novelId = body.novel_id || planSession.novel_id || null;
    if (def.feature_key !== 'basic' && !novelId) {
      const err = new Error('请先保存基础信息');
      err.status = 400;
      err.code = 'NOVEL_REQUIRED';
      throw err;
    }

    const targetSession = await this.ensureTargetSession(planSession, def, novelId);
    const snapshot = body.form_snapshot && typeof body.form_snapshot === 'object'
      ? body.form_snapshot
      : {};
    const turn = await this.ctx.service.aiTurn.run(targetSession.id, {
      message: body.message || task.reason || `执行${def.label}`,
      scene: def.scene,
      form_snapshot: snapshot,
    });

    if (def.feature_key === 'basic' && !novelId) {
      const title = String(turn.patch?.title || '').trim() || '未命名开书';
      const created = await this.ctx.service.novel.create({
        title,
        creative_intent: turn.patch?.creative_intent || '',
        summary: turn.patch?.summary || '',
        status: 'draft',
      });
      novelId = created.id;
      await this.ctx.service.aiSession.update(planSession.id, { novel_id: novelId });
      await this.ctx.service.aiSession.update(targetSession.id, { novel_id: novelId });
      if (turn.messages) {
        const assistant = [...turn.messages].reverse().find((row) => row.role === 'assistant');
        if (assistant?.id) {
          await this.ctx.service.aiSession.applyMessage(targetSession.id, assistant.id, ['title', 'creative_intent', 'summary']);
        }
      }
    }

    const nextTasks = markTaskStatus(tasks, task.id, 'applied');
    await planMessage.update({ patch_json: { ...planMessage.patch_json, tasks: nextTasks } });

    return {
      novel_id: novelId,
      step: def.step,
      feature_key: def.feature_key,
      task: { ...task, status: 'applied' },
      tasks: nextTasks,
      target_session_id: targetSession.id,
      plan_session_id: planSession.id,
      turn: {
        session_id: turn.session_id,
        reply: turn.reply,
        patch: turn.patch,
      },
    };
  }
}

module.exports = AiDispatchService;
