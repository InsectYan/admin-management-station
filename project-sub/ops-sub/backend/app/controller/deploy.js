'use strict';

const Controller = require('egg').Controller;
const { onJobEvent } = require('../lib/deployEvents');

class DeployController extends Controller {
  success(data) {
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  fail(err) {
    const status = err.status || 500;
    this.ctx.status = status;
    this.ctx.body = { code: status, message: err.message || '请求失败', data: err.code ? { error_code: err.code } : null };
  }

  async products() {
    const { listProductsPublic } = require('../lib/deployProducts');
    this.success(listProductsPublic());
  }

  async gitTags() {
    try {
      const data = await this.ctx.service.deploy.listGitTags(this.ctx.params.id, this.ctx.query);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async create() {
    try {
      const job = await this.ctx.service.deploy.createJob(this.ctx.params.id, this.ctx.request.body || {});
      this.success({ job });
    } catch (err) {
      this.fail(err);
    }
  }

  async listByProject() {
    try {
      const data = await this.ctx.service.deploy.listJobs(this.ctx.query, this.ctx.params.id);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async listAll() {
    try {
      const data = await this.ctx.service.deploy.listJobs(this.ctx.query);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async summary() {
    try {
      const data = await this.ctx.service.deploy.summarize();
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async show() {
    try {
      const job = await this.ctx.service.deploy.getJob(this.ctx.params.jobId);
      this.success({ job });
    } catch (err) {
      this.fail(err);
    }
  }

  async logs() {
    try {
      const data = await this.ctx.service.deploy.listLogs(this.ctx.params.jobId, this.ctx.query);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async logsText() {
    try {
      const text = await this.ctx.service.deploy.exportLogsText(this.ctx.params.jobId);
      this.ctx.set('Content-Type', 'text/plain; charset=utf-8');
      this.ctx.set('Content-Disposition', `attachment; filename="deploy-${this.ctx.params.jobId}.txt"`);
      this.ctx.body = text || '';
    } catch (err) {
      this.fail(err);
    }
  }

  async retry() {
    try {
      const job = await this.ctx.service.deploy.retry(this.ctx.params.jobId);
      this.success({ job });
    } catch (err) {
      this.fail(err);
    }
  }

  async abort() {
    try {
      const job = await this.ctx.service.deploy.abort(this.ctx.params.jobId);
      this.success({ job });
    } catch (err) {
      this.fail(err);
    }
  }

  async stream() {
    const ctx = this.ctx;
    let off = () => {};
    let heartbeat;
    try {
      const job = await ctx.service.deploy.getJob(ctx.params.jobId);
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

      const after = ctx.query.after;
      const history = await ctx.service.deploy.listLogs(job.id, { after, limit: 2000 });
      for (const line of history.list) write('log', line);
      write('status', await ctx.service.deploy.getJob(job.id));

      const terminal = [ 'success', 'failed', 'aborted' ];
      if (terminal.includes(job.status) && history.list.length) {
        write('end', { status: job.status });
        ctx.res.end();
        return;
      }
      if (terminal.includes(job.status)) {
        write('end', { status: job.status });
        ctx.res.end();
        return;
      }

      off = onJobEvent(job.id, ({ event, payload }) => {
        if (ctx.res.writableEnded) return;
        write(event, payload);
        if (event === 'end') {
          clearInterval(heartbeat);
          off();
          ctx.res.end();
        }
      });

      const latest = await ctx.service.deploy.getJob(job.id);
      if (terminal.includes(latest.status)) {
        write('status', latest);
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
        ctx.res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        ctx.res.end();
        return;
      }
      this.fail(err);
    }
  }
}

module.exports = DeployController;
