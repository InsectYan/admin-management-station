'use strict';

const Service = require('egg').Service;
const { cartoonQuery, cartoonRequest } = require('../lib/cartoonClient');

const RULES = [
  { rule_key: 'queue_backlog', name: '队列堆积', level: 'warning' },
  { rule_key: 'task_stuck', name: '任务卡住', level: 'critical' },
  { rule_key: 'fail_rate', name: '失败率过高', level: 'warning' },
  { rule_key: 'dep_down', name: '依赖不可用', level: 'critical' },
];

function suggest(task) {
  const err = String(task?.error_message || '');
  if (!err.trim()) {
    return {
      stage: 'comfy',
      suggestion: '没有错误说明。先看依赖健康里的 ComfyUI，确认任务是否还在跑。',
      safe_action: 'check_dep',
    };
  }
  if (err.includes('预检')) {
    return {
      stage: 'precheck',
      suggestion: '失败发生在出图前预检。打开依赖健康，确认预检服务可用。',
      safe_action: 'check_dep',
    };
  }
  if (/超时|连不上|timeout|ECONNREFUSED|fetch failed/i.test(err)) {
    return {
      stage: 'unknown',
      suggestion: '连不上下游。打开依赖健康，看预检和 ComfyUI。',
      safe_action: 'check_dep',
    };
  }
  if (err.includes('ComfyUI')) {
    return {
      stage: 'comfy',
      suggestion: 'ComfyUI 执行或连接失败。确认依赖健康正常后可以重试。',
      safe_action: 'retry',
    };
  }
  return {
    stage: 'unknown',
    suggestion: '按错误说明处理。确认下游正常后可以重试。',
    safe_action: 'retry',
  };
}

function isCartoonScope(bizApp) {
  return !bizApp || bizApp === 'platform' || bizApp === 'cartoon';
}

class ContentService extends Service {
  actor() {
    return this.ctx.state.user?.username || 'unknown';
  }

  assertAdmin() {
    if (this.ctx.state.user?.role !== 'admin') this.ctx.throw(403, '需要管理员');
  }

  async writeAudit(entry) {
    await this.ctx.model.OpsAuditLog.create({
      actor: this.actor(),
      action: entry.action,
      biz_app: entry.biz_app || null,
      external_type: entry.external_type || null,
      external_id: entry.external_id != null ? String(entry.external_id) : null,
      detail: entry.detail || {},
    });
  }

  async ensureConfig() {
    let row = await this.ctx.model.OpsRuntimeConfig.findByPk(1);
    if (!row) row = await this.ctx.model.OpsRuntimeConfig.create({ id: 1 });
    return row;
  }

  async ensureRules() {
    const rows = [];
    for (const item of RULES) {
      const [ row ] = await this.ctx.model.OpsAlertRule.findOrCreate({
        where: { rule_key: item.rule_key },
        defaults: { ...item, enabled: true },
      });
      rows.push(row);
    }
    return rows;
  }

  toPublicConfig(row) {
    return {
      queue_backlog: row.queue_backlog,
      stuck_minutes: row.stuck_minutes,
      fail_rate: Number(row.fail_rate),
      fail_min_samples: row.fail_min_samples,
      retention_days: row.retention_days,
    };
  }

  async cartoon(path, options) {
    return cartoonRequest(this.app, path, options);
  }

  async overview(query) {
    const config = await this.ensureConfig();
    const openAlerts = await this.ctx.model.OpsAlert.count({ where: { status: 'open' } });
    let deploy = null;
    try {
      deploy = await this.ctx.service.deploy.summarize();
    } catch (err) {
      this.ctx.logger.warn('[content] deploy summary %s', err.message);
    }
    const deps = await this.deps();
    if (!isCartoonScope(query.biz_app)) {
      return {
        biz_app: query.biz_app,
        config: this.toPublicConfig(config),
        cartoon: null,
        cartoon_error: '小说写作会话将在后续接入',
        deploy,
        open_alerts: openAlerts,
        deps,
      };
    }
    let cartoon = null;
    let cartoonError = '';
    try {
      cartoon = await this.cartoon(cartoonQuery('/api/internal/ops/summary', {
        project_id: query.project_id,
        stuck_minutes: config.stuck_minutes,
      }));
    } catch (err) {
      cartoonError = err.message;
    }
    return {
      biz_app: query.biz_app || 'platform',
      config: this.toPublicConfig(config),
      cartoon,
      cartoon_error: cartoonError,
      deploy,
      open_alerts: openAlerts,
      deps,
    };
  }

  async projects(query) {
    if (!isCartoonScope(query.biz_app)) return [];
    return this.cartoon('/api/internal/ops/projects');
  }

  async jobs(query) {
    if (!isCartoonScope(query.biz_app)) {
      return { list: [], total: 0, note: '小说写作会话将在后续接入' };
    }
    const config = await this.ensureConfig();
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const data = await this.cartoon(cartoonQuery('/api/internal/ops/tasks', {
      project_id: query.project_id,
      status: query.stuck === '1' ? undefined : query.status,
      stuck: query.stuck === '1' ? '1' : undefined,
      stuck_minutes: config.stuck_minutes,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }));
    const stuckBefore = Date.now() - config.stuck_minutes * 60 * 1000;
    return {
      ...data,
      page,
      pageSize,
      stuck_minutes: config.stuck_minutes,
      list: (data.list || []).map(item => ({
        ...item,
        biz_app: 'cartoon',
        stuck: [ 'running', 'saving' ].includes(item.status)
          && new Date(item.updated_at).getTime() < stuckBefore,
      })),
    };
  }

  async showJob(bizApp, externalId) {
    if (bizApp !== 'cartoon') this.ctx.throw(400, '当前只接入漫剧任务');
    const task = await this.cartoon(`/api/internal/ops/tasks/${externalId}`);
    const config = await this.ensureConfig();
    const stuckBefore = Date.now() - config.stuck_minutes * 60 * 1000;
    return {
      ...task,
      biz_app: 'cartoon',
      stuck: [ 'running', 'saving' ].includes(task.status)
        && new Date(task.updated_at).getTime() < stuckBefore,
      diagnosis: suggest(task),
    };
  }

  async retryJob(bizApp, externalId) {
    if (bizApp !== 'cartoon') this.ctx.throw(400, '当前只接入漫剧任务');
    const task = await this.cartoon(`/api/internal/ops/tasks/${externalId}/retry`, {
      method: 'POST',
      timeoutMs: 70000,
    });
    await this.writeAudit({
      action: 'task.retry',
      biz_app: 'cartoon',
      external_type: 'task',
      external_id: externalId,
      detail: { status: task.status },
    });
    return { ...task, biz_app: 'cartoon', diagnosis: suggest(task) };
  }

  async cancelJob(bizApp, externalId) {
    if (bizApp !== 'cartoon') this.ctx.throw(400, '当前只接入漫剧任务');
    const task = await this.cartoon(`/api/internal/ops/tasks/${externalId}/cancel`, { method: 'POST' });
    await this.writeAudit({
      action: 'task.cancel',
      biz_app: 'cartoon',
      external_type: 'task',
      external_id: externalId,
      detail: { status: task.status },
    });
    return { ...task, biz_app: 'cartoon', diagnosis: suggest(task) };
  }

  streaks() {
    if (!this.app.opsDepStreak) this.app.opsDepStreak = {};
    return this.app.opsDepStreak;
  }

  async probeOnce() {
    const targets = this.config.contentOps.deps || [];
    const streaks = this.streaks();
    const results = [];
    for (const target of targets) {
      const started = Date.now();
      let up = false;
      let message = '正常';
      try {
        const res = await fetch(target.url, { signal: AbortSignal.timeout(4000) });
        up = res.ok;
        if (!up) message = `HTTP ${res.status}`;
      } catch (err) {
        message = err.name === 'TimeoutError' ? '超时' : (err.message || '连不上');
      }
      results.push({
        key: target.key,
        name: target.name,
        up,
        message,
        latency_ms: Date.now() - started,
        fail_streak: streaks[target.key] || 0,
      });
    }
    return results;
  }

  async deps() {
    return this.probeOnce();
  }

  async listAlerts(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where = {};
    if (query.status) where.status = String(query.status);
    const { rows, count } = await this.ctx.model.OpsAlert.findAndCountAll({
      where,
      order: [[ 'created_at', 'DESC' ]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const openCount = await this.ctx.model.OpsAlert.count({ where: { status: 'open' } });
    return {
      list: rows,
      total: count,
      page,
      pageSize,
      open_count: openCount,
    };
  }

  async ackAlert(id, body = {}) {
    const alert = await this.ctx.model.OpsAlert.findByPk(id);
    if (!alert) this.ctx.throw(404, '告警不存在');
    if (alert.status !== 'open') this.ctx.throw(400, '只有未处理的告警可以认领');
    await alert.update({
      status: 'ack',
      assignee: this.actor(),
      acked_at: new Date(),
      note: body.note ? String(body.note).slice(0, 500) : alert.note,
    });
    await this.writeAudit({
      action: 'alert.ack',
      external_type: 'alert',
      external_id: alert.id,
      detail: { rule_key: alert.rule_key, object_key: alert.object_key },
    });
    return alert;
  }

  async resolveAlert(id, body = {}) {
    const alert = await this.ctx.model.OpsAlert.findByPk(id);
    if (!alert) this.ctx.throw(404, '告警不存在');
    if (![ 'open', 'ack' ].includes(alert.status)) this.ctx.throw(400, '告警已关闭');
    await alert.update({
      status: 'resolved',
      assignee: alert.assignee || this.actor(),
      resolved_at: new Date(),
      note: body.note ? String(body.note).slice(0, 500) : alert.note,
    });
    await this.writeAudit({
      action: 'alert.resolve',
      external_type: 'alert',
      external_id: alert.id,
      detail: { rule_key: alert.rule_key, object_key: alert.object_key },
    });
    return alert;
  }

  async listAudit(query) {
    const { Op } = this.app.Sequelize;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where = {};
    if (query.action) where.action = String(query.action);
    if (query.biz_app) where.biz_app = String(query.biz_app);
    if (query.actor) where.actor = { [Op.iLike]: `%${String(query.actor).slice(0, 64)}%` };
    const { rows, count } = await this.ctx.model.OpsAuditLog.findAndCountAll({
      where,
      order: [[ 'created_at', 'DESC' ]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { list: rows, total: count, page, pageSize };
  }

  async getSettings() {
    this.assertAdmin();
    const row = await this.ensureConfig();
    const rules = await this.ensureRules();
    return {
      ...this.toPublicConfig(row),
      rules: rules.map(item => ({
        rule_key: item.rule_key,
        name: item.name,
        level: item.level,
        enabled: item.enabled,
      })),
    };
  }

  async updateSettings(body) {
    this.assertAdmin();
    const queue = Number(body.queue_backlog);
    const stuck = Number(body.stuck_minutes);
    const rate = Number(body.fail_rate);
    const samples = Number(body.fail_min_samples);
    if (!Number.isInteger(queue) || queue < 1 || queue > 10000) this.ctx.throw(400, '堆积阈值应为 1 到 10000 的整数');
    if (!Number.isInteger(stuck) || stuck < 1 || stuck > 1440) this.ctx.throw(400, '卡住分钟数应为 1 到 1440 的整数');
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1) this.ctx.throw(400, '失败率阈值应大于 0 且不超过 1');
    if (!Number.isInteger(samples) || samples < 1 || samples > 100) this.ctx.throw(400, '失败率样本数应为 1 到 100 的整数');
    const row = await this.ensureConfig();
    const before = this.toPublicConfig(row);
    await row.update({
      queue_backlog: queue,
      stuck_minutes: stuck,
      fail_rate: rate,
      fail_min_samples: samples,
    });
    await this.writeAudit({
      action: 'config.update',
      external_type: 'runtime_config',
      external_id: row.id,
      detail: { before, after: this.toPublicConfig(row) },
    });
    return this.getSettings();
  }

  async openAlert(payload) {
    const { Op } = this.app.Sequelize;
    const where = {
      rule_key: payload.rule_key,
      object_key: payload.object_key,
      status: { [Op.in]: [ 'open', 'ack' ] },
    };
    const existing = await this.ctx.model.OpsAlert.findOne({ where });
    if (existing) return existing;
    try {
      return await this.ctx.model.OpsAlert.create({
        ...payload,
        status: 'open',
      });
    } catch (err) {
      const again = await this.ctx.model.OpsAlert.findOne({ where });
      if (again) return again;
      throw err;
    }
  }

  async clearAlert(ruleKey, objectKey) {
    const { Op } = this.app.Sequelize;
    await this.ctx.model.OpsAlert.update({
      status: 'resolved',
      resolved_at: new Date(),
    }, {
      where: {
        rule_key: ruleKey,
        object_key: objectKey,
        status: { [Op.in]: [ 'open', 'ack' ] },
      },
    });
  }

  async watchDeps(rules) {
    if (rules.dep_down === false) return this.probeOnce();
    const live = await this.probeOnce();
    const streaks = this.streaks();
    for (const item of live) {
      if (item.up) {
        streaks[item.key] = 0;
        await this.clearAlert('dep_down', `dep:${item.key}`);
        item.fail_streak = 0;
        continue;
      }
      streaks[item.key] = (streaks[item.key] || 0) + 1;
      item.fail_streak = streaks[item.key];
      if (streaks[item.key] >= 2) {
        await this.openAlert({
          rule_key: 'dep_down',
          object_key: `dep:${item.key}`,
          level: 'critical',
          title: `${item.name}不可用`,
          detail: item.message,
        });
      }
    }
    return live;
  }

  async watchTasks(rules, config) {
    let summary;
    try {
      summary = await this.cartoon(cartoonQuery('/api/internal/ops/summary', {
        stuck_minutes: config.stuck_minutes,
      }));
    } catch (err) {
      this.ctx.logger.warn('[contentWatch] cartoon %s', err.message);
      return;
    }
    if (rules.queue_backlog !== false) {
      if (summary.backlog > config.queue_backlog) {
        await this.openAlert({
          rule_key: 'queue_backlog',
          object_key: 'cartoon',
          level: 'warning',
          title: '漫剧队列堆积',
          detail: `待处理 ${summary.backlog}，阈值 ${config.queue_backlog}`,
        });
      } else {
        await this.clearAlert('queue_backlog', 'cartoon');
      }
    }
    if (rules.fail_rate !== false) {
      const samples = summary.hour_success + summary.hour_failed;
      const rate = samples ? summary.hour_failed / samples : 0;
      if (samples >= config.fail_min_samples && rate > Number(config.fail_rate)) {
        await this.openAlert({
          rule_key: 'fail_rate',
          object_key: 'cartoon',
          level: 'warning',
          title: '漫剧近一小时失败率过高',
          detail: `失败 ${summary.hour_failed} / ${samples}`,
        });
      } else {
        await this.clearAlert('fail_rate', 'cartoon');
      }
    }
    if (rules.task_stuck !== false) {
      const stuckKeys = new Set((summary.stuck || []).map(item => `cartoon:task:${item.id}`));
      for (const item of summary.stuck || []) {
        await this.openAlert({
          rule_key: 'task_stuck',
          object_key: `cartoon:task:${item.id}`,
          level: 'critical',
          title: `漫剧任务 #${item.id} 卡住`,
          detail: item.project_name ? `${item.project_name} · ${item.status}` : item.status,
        });
      }
      const { Op } = this.app.Sequelize;
      const openStuck = await this.ctx.model.OpsAlert.findAll({
        where: { rule_key: 'task_stuck', status: { [Op.in]: [ 'open', 'ack' ] } },
      });
      for (const alert of openStuck) {
        if (!stuckKeys.has(alert.object_key)) await this.clearAlert('task_stuck', alert.object_key);
      }
    }
  }

  async tick() {
    const configRow = await this.ensureConfig();
    const config = this.toPublicConfig(configRow);
    const rules = await this.ensureRules();
    const enabled = Object.fromEntries(rules.map(item => [ item.rule_key, item.enabled ]));
    const deps = await this.watchDeps(enabled);
    await this.watchTasks(enabled, config);
    const openAlerts = await this.ctx.model.OpsAlert.count({ where: { status: 'open' } });
    return { deps, open_alerts: openAlerts };
  }
}

module.exports = ContentService;
