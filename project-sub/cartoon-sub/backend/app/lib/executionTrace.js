'use strict';

const VIDEO_KINDS = new Set([ 'video', 'i2v', 't2v', 'refmod' ]);

function baseOf(ctx) {
  return String(ctx.app.config.agentPlatform?.baseUrl || '').replace(/\/$/, '');
}

async function post(ctx, path, body) {
  const base = baseOf(ctx);
  if (!base) return null;
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) return null;
  return res.json();
}

async function openRun(ctx, fields) {
  try {
    const data = await post(ctx, '/api/executions', fields);
    return Number(data?.id) || 0;
  } catch (err) {
    ctx.logger.warn('[cartoon] 执行轨迹没有打开 %s', err.message);
    return 0;
  }
}

async function closeRun(ctx, runId, fields = {}) {
  if (!runId) return;
  try {
    await post(ctx, `/api/executions/${runId}/finish`, fields);
  } catch (err) {
    ctx.logger.warn('[cartoon] 执行轨迹没有收口 %s', err.message);
  }
}

async function noteStep(ctx, runId, fields) {
  if (!runId) return 0;
  try {
    const data = await post(ctx, `/api/executions/${runId}/steps`, fields);
    return Number(data?.id) || 0;
  } catch (err) {
    ctx.logger.warn('[cartoon] 执行节点没有写下 %s', err.message);
    return 0;
  }
}

async function finishStep(ctx, runId, stepId, fields) {
  if (!runId || !stepId) return;
  try {
    await post(ctx, `/api/executions/${runId}/steps/${stepId}/finish`, fields);
  } catch (err) {
    ctx.logger.warn('[cartoon] 执行节点没有收口 %s', err.message);
  }
}

async function startMediaWatch(ctx, task) {
  const video = VIDEO_KINDS.has(String(task?.kind || ''));
  let label = '';
  try {
    if (task?.shot_id) {
      const shot = await ctx.model.Shot.findByPk(task.shot_id, { attributes: [ 'shot_code' ] });
      label = String(shot?.shot_code || '');
    }
  } catch {
    label = '';
  }
  if (!label && task?.id) label = `任务 ${task.id}`;
  const runId = await openRun(ctx, {
    app_key: 'cartoon',
    skill_name: video ? 'video-wait' : 'image-wait',
    action: 'wait',
    flow_key: video ? 'video' : 'image',
    title: video ? '生成视频' : '生成图片',
    target_label: label,
  });
  let waitStep = 0;
  if (runId) {
    await noteStep(ctx, runId, {
      node_key: 'submit',
      title: video ? '提交成片' : '提交图片',
      skill_name: video ? 'video-wait' : 'image-wait',
      status: 'ok',
      log_text: task?.id ? `任务 ${task.id}` : '已提交',
      elapsed_ms: 0,
    });
    waitStep = await noteStep(ctx, runId, {
      node_key: 'wait',
      title: video ? '等待成片' : '等待图片',
      skill_name: video ? 'video-wait' : 'image-wait',
      status: 'running',
      log_text: '等待 ComfyUI',
    });
  }
  return {
    async close(status, errorText, elapsedMs) {
      const state = status === 'skip' ? 'skip' : (status === 'error' ? 'error' : 'ok');
      const note = String(errorText || '').slice(0, 300);
      await finishStep(ctx, runId, waitStep, {
        status: state,
        log_text: state === 'ok' ? '等待结束' : (note || '未完成'),
        error_text: state === 'error' ? note : '',
        elapsed_ms: elapsedMs,
      });
      await closeRun(ctx, runId, {
        status: state,
        error_text: state === 'error' ? note : '',
        elapsed_ms: elapsedMs,
      });
    },
  };
}

module.exports = {
  openRun,
  closeRun,
  noteStep,
  startMediaWatch,
};
