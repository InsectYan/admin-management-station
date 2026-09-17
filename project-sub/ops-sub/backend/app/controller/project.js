'use strict';

const Controller = require('egg').Controller;

class ProjectController extends Controller {
  success(data) {
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  fail(err) {
    const status = err.status || 500;
    this.ctx.status = status;
    this.ctx.body = { code: status, message: err.message || '请求失败' };
  }

  async index() {
    try {
      const data = await this.ctx.service.project.list(this.ctx.query);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async template() {
    this.success(this.ctx.service.project.template());
  }

  async show() {
    try {
      const data = await this.ctx.service.project.findById(this.ctx.params.id);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async create() {
    try {
      const data = await this.ctx.service.project.create(this.ctx.request.body);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async update() {
    try {
      const data = await this.ctx.service.project.update(this.ctx.params.id, this.ctx.request.body);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async destroy() {
    try {
      const data = await this.ctx.service.project.destroy(this.ctx.params.id);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async importFile() {
    try {
      const data = await this.ctx.service.project.importDocument(this.ctx.request.body);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async createImportJob() {
    try {
      const job = await this.ctx.service.importJob.create(this.ctx.request.body || {});
      this.success({ job });
    } catch (err) {
      this.fail(err);
    }
  }

  async showImportJob() {
    try {
      const job = await this.ctx.service.importJob.getJob(this.ctx.params.jobId);
      this.success({ job });
    } catch (err) {
      this.fail(err);
    }
  }

  async streamImport() {
    const ctx = this.ctx;
    const { onImportEvent } = require('../lib/importEvents');
    let off = () => {};
    let heartbeat;
    try {
      const job = await ctx.service.importJob.getJob(ctx.params.jobId);
      ctx.req.setTimeout(0);
      ctx.res.setTimeout(0);
      ctx.respond = false;
      ctx.res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const write = (event, payload) => {
        ctx.res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
      };

      write('status', job);
      const terminal = [ 'success', 'failed' ];
      if (terminal.includes(job.status)) {
        if (job.status === 'success') {
          write('done', { project_id: job.result_project_id, name: job.result_name, status: 'success' });
        } else {
          write('fail', { message: job.error || '导入失败', status: 'failed' });
        }
        write('end', { status: job.status });
        ctx.res.end();
        return;
      }

      off = onImportEvent(job.id, ({ event, payload }) => {
        if (ctx.res.writableEnded) return;
        write(event, payload);
        if (event === 'end') {
          clearInterval(heartbeat);
          off();
          ctx.res.end();
        }
      });

      const latest = await ctx.service.importJob.getJob(job.id);
      if (terminal.includes(latest.status)) {
        write('status', latest);
        if (latest.status === 'success') {
          write('done', { project_id: latest.result_project_id, name: latest.result_name, status: 'success' });
        } else {
          write('fail', { message: latest.error || '导入失败', status: 'failed' });
        }
        write('end', { status: latest.status });
        off();
        ctx.res.end();
        return;
      }

      heartbeat = setInterval(() => {
        if (ctx.res.writableEnded) {
          clearInterval(heartbeat);
          return;
        }
        ctx.res.write(': keepalive\n\n');
      }, 15000);

      ctx.req.on('close', () => {
        clearInterval(heartbeat);
        off();
      });
    } catch (err) {
      if (ctx.respond === false) {
        ctx.res.write(`event: fail\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        ctx.res.end();
        return;
      }
      this.fail(err);
    }
  }

  async exportFile() {
    try {
      const row = await this.ctx.service.project.findById(this.ctx.params.id);
      this.success(this.ctx.service.project.exportDocument(row));
    } catch (err) {
      this.fail(err);
    }
  }

  async generate() {
    try {
      const data = await this.ctx.service.project.generateConfig(this.ctx.request.body);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async generateApply() {
    try {
      const data = await this.ctx.service.project.generateAndApply(this.ctx.params.id, this.ctx.request.body);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }
}

module.exports = ProjectController;
