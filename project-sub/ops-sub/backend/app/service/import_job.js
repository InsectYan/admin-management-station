'use strict';

const { Service } = require('egg');
const { parseImportDocument } = require('../lib/projectTemplate');
const { emitImportEvent } = require('../lib/importEvents');
const { stashImportPayload, takeImportPayload } = require('../lib/importPayloads');

const TERMINAL = [ 'success', 'failed' ];

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class ImportJobService extends Service {
  actorName() {
    return String(this.ctx.state.user?.username || '').trim() || 'local';
  }

  toPublic(row) {
    return typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  }

  async getJob(jobId) {
    const row = await this.ctx.model.OpsImportJob.findByPk(jobId);
    if (!row) throw fail('导入任务不存在', 404);
    return this.toPublic(row);
  }

  async patch(jobId, next) {
    const row = await this.ctx.model.OpsImportJob.findByPk(jobId);
    if (!row) throw fail('导入任务不存在', 404);
    await row.update(next);
    const job = this.toPublic(row);
    emitImportEvent(jobId, 'status', job);
    return job;
  }

  async emitPhase(jobId, phase, percent, message) {
    await this.patch(jobId, { phase, status: 'running' });
    emitImportEvent(jobId, 'phase', { phase, percent, message });
  }

  async create(body = {}) {
    const { app } = this;
    const row = await this.ctx.model.transaction(async transaction => {
      return this.ctx.model.OpsImportJob.create({
        status: 'queued',
        phase: 'queued',
        triggered_by: this.actorName(),
      }, { transaction });
    });
    stashImportPayload(row.id, body);
    setImmediate(() => {
      const ctx = app.createAnonymousContext();
      ctx.service.importJob.run(row.id).catch(err => {
        app.logger.error('[ImportJob] %s %s', row.id, err.message);
      });
    });
    return this.toPublic(row);
  }

  async run(jobId) {
    try {
      await this.emitPhase(jobId, 'parse', 15, '解析文档');
      await sleep(40);
      const raw = takeImportPayload(jobId);
      if (!raw || typeof raw !== 'object') throw fail('导入内容为空');

      await this.emitPhase(jobId, 'validate', 45, '校验模板');
      await sleep(40);
      const payload = parseImportDocument(raw);

      await this.emitPhase(jobId, 'write', 80, '写入项目库');
      const project = await this.ctx.service.project.create({
        ...payload,
        type: payload.project_type,
      });

      const job = await this.patch(jobId, {
        status: 'success',
        phase: 'done',
        result_project_id: project.id,
        result_name: project.name,
        finished_at: new Date(),
      });
      emitImportEvent(jobId, 'done', {
        project_id: project.id,
        name: project.name,
        status: 'success',
      });
      emitImportEvent(jobId, 'end', { status: 'success' });
      return job;
    } catch (err) {
      const job = await this.patch(jobId, {
        status: 'failed',
        phase: 'error',
        error: err.message.slice(0, 500),
        finished_at: new Date(),
      });
      emitImportEvent(jobId, 'fail', { message: err.message, status: 'failed' });
      emitImportEvent(jobId, 'end', { status: 'failed' });
      return job;
    }
  }
}

ImportJobService.TERMINAL = TERMINAL;

module.exports = ImportJobService;
